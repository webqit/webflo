import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import Mime from 'mime-types';
import QueryString from 'querystring';
import Observer from '@webqit/observer';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { slice as _streamSlice } from 'stream-slice';
import { Readable as _ReadableStream } from 'stream';
import { Context } from './Context.js';
import { CookieStorage } from './CookieStorage.js';
import { SessionStorage } from './SessionStorage.js';
import { AbstractController } from '../AbstractController.js';
import { HttpEvent } from '../HttpEvent.js';
import { Router } from './Router.js';
import { pattern } from '../util-url.js';
import xfetch from '../xfetch.js';
import '../util-http.js';

const parseDomains = (domains) => _arrFrom(domains).reduce((arr, str) => arr.concat(str.split(',')), []).map(str => str.trim()).filter(str => str);
const selectDomains = (serverDefs, matchingPort = null) => serverDefs.reduce((doms, def) => doms.length ? doms : (((!matchingPort || def.port === matchingPort) && parseDomains(def.domains || def.hostnames)) || []), []);

export class WebfloServer extends AbstractController {

    static get Context() { return Context; }

    static get Router() { return Router; }

    static get HttpEvent() { return HttpEvent; }

    static get CookieStorage() { return CookieStorage; }

    static get SessionStorage() { return SessionStorage; }

    static create(cx) {
        return new this(this.Context.create(cx));
    }

    #cx;
    get cx() { return this.#cx; }

    constructor(cx) {
        super();
        if (!(cx instanceof this.constructor.Context)) {
            throw new Error('Argument #2 must be a Webflo Context instance');
        }
        this.#cx = cx;
    }

    async initialize() {
        const resolveContextObj = async (cx, force = false) => {
            if (_isEmpty(cx.layout) || force) { cx.layout = await (new cx.config.deployment.Layout(cx)).read(); }
            if (_isEmpty(cx.server) || force) { cx.server = await (new cx.config.runtime.Server(cx)).read(); }
            if (_isEmpty(cx.env) || force) { cx.env = await (new cx.config.deployment.Env(cx)).read(); }
        };
        await resolveContextObj(this.cx);
        if (this.cx.env.autoload !== false) {
            Object.keys(this.cx.env.entries).forEach(key => {
                if (!(key in process.env)) {
                    process.env[key] = this.cx.env.entries[key];
                }
            });
        }
        // ---------------
        this.proxied = new Map;
        if (this.cx.config.deployment.Proxy) {
            const proxied = await (new this.cx.config.deployment.Proxy(this.cx)).read();
            await Promise.all((proxied.entries || []).map(async vhost => {
                let cx, hostnames = parseDomains(vhost.hostnames), port = vhost.port, proto = vhost.proto;
                if (vhost.path) {
                    cx = this.cx.constructor.create(this.cx, Path.join(this.cx.CWD, vhost.path));
                    await resolveContextObj(cx, true);
                    cx.dict.key = true;
                    // From the server that's most likely to be active
                    port || (port = cx.server.https.port || cx.server.port);
                    // The domain list that corresponds to the specified resolved port
                    hostnames.length || (hostnames = selectDomains([cx.server.https, cx.server], port));
                    // Or anyone available... hoping that the remote configs can eventually be in sync
                    hostnames.length || (hostnames = selectDomains([cx.server.https, cx.server]));
                    // The corresponding proto
                    proto || (proto = port === cx.server.https.port ? 'https' : 'http');
                }
                hostnames.length || (hostnames = ['*']);
                this.proxied.set(hostnames.sort().join('|'), { cx, hostnames, port, proto });
            }));
        }
        // ---------------
        this.control();
        if (this.cx.logger) {
            if (this.servers.size) {
                this.cx.logger.info(`> Server running! (${this.cx.app.title || ''})`);
                for (let [proto, def] of this.servers) {
                    this.cx.logger.info(`> ${proto.toUpperCase()} / ${def.domains.concat('').join(`:${def.port} / `)}`);
                }
            } else {
                this.cx.logger.info(`> Server not running! No port specified.`);
            }
            if (this.proxied.size) {
                this.cx.logger.info(`> Reverse proxy active.`);
                for (let [id, def] of this.proxied) {
                    this.cx.logger.info(`> ${id} >>> ${def.port}`);
                }
            }
            this.cx.logger.info(``);
        }
    }

    control() {
        this.servers = new Map;
        // ---------------
        if (!this.cx.flags['test-only'] && !this.cx.flags['https-only'] && this.cx.server.port) {
            const httpServer = Http.createServer((request, response) => handleRequest('http', request, response));
            httpServer.listen(this.cx.server.port);
            // -------
            let domains = parseDomains(this.cx.server.domains);
            if (!domains.length) { domains = ['*']; }
            this.servers.set('http', {
                instance: httpServer,
                port: this.cx.server.port,
                domains,
            });
        }
        // ---------------
        if (!this.cx.flags['test-only'] && !this.cx.flags['http-only'] && this.cx.server.https.port) {
            const httpsServer = Https.createServer((request, response) => handleRequest('https', request, response));
            httpsServer.listen(this.cx.server.https.port);
            // -------
            const addSSLContext = (serverConfig, domains) => {
                if (!Fs.existsSync(serverConfig.https.keyfile)) return;
                const cert = {
                    key: Fs.readFileSync(serverConfig.https.keyfile),
                    cert: Fs.readFileSync(serverConfig.https.certfile),
                };
                domains.forEach(domain => { httpsServer.addContext(domain, cert); });
            }
            // -------
            let domains = parseDomains(this.cx.server.https.domains);
            if (!domains.length) { domains = ['*']; }
            this.servers.set('https', {
                instance: httpsServer,
                port: this.cx.server.https.port,
                domains,
            });
            // -------
            addSSLContext(this.cx.server, domains);
            for (const [ /*id*/, vhost] of this.proxied) {
                vhost.cx && addSSLContext(vhost.cx.server, vhost.hostnames);
            }
        }
        // ---------------
        const handleRequest = async (proto, request, response) => {
            request[Symbol.toStringTag] = 'ReadableStream';
            const [fullUrl, requestInit] = this.parseNodeRequest(proto, request);
            const clientResponse = await this.navigate(fullUrl, requestInit, { request, response });
            if (response.headersSent) return;
            // --------
            for (const [name, value] of clientResponse.headers) {
                const existing = response.getHeader(name);
                if (existing) response.setHeader(name, [].concat(existing).concat(value));
                else response.setHeader(name, value);
            }
            // --------
            response.statusCode = clientResponse.status;
            response.statusMessage = clientResponse.statusText;
            if (clientResponse.headers.has('Location')) {
                return response.end();
            }
            if ((clientResponse.body instanceof _ReadableStream)) {
                return clientResponse.body.pipe(response);
            }
            if ((clientResponse.body instanceof ReadableStream)) {
                return _ReadableStream.from(clientResponse.body).pipe(response);
            }
            let body = clientResponse.body;
            if (clientResponse.headers.get('Content-Type') === 'application/json') {
                body += '';
            }
            return response.end(body);
        };
    }

    parseNodeRequest(proto, request) {
        // Detected when using manual proxy setting in a browser
        if (request.url.startsWith(`http://${request.headers.host}`) || request.url.startsWith(`https://${request.headers.host}`)) {
            request.url = request.url.split(request.headers.host)[1];
        }
        const fullUrl = proto + '://' + request.headers.host + request.url;
        const requestInit = { method: request.method, headers: request.headers };
        if (!['GET', 'HEAD'].includes(request.method)) {
            requestInit.body = request;
            requestInit.duplex = 'half'; // See https://github.com/nodejs/node/issues/46221
        }
        return [fullUrl, requestInit];
    }

    writeAutoHeaders(headers, autoHeaders) {
        autoHeaders.forEach(header => {
            var headerName = header.name.toLowerCase(),
                headerValue = header.value,
                isAppend = headerName.startsWith('+') ? (headerName = headerName.substr(1), true) : false,
                isPrepend = headerName.endsWith('+') ? (headerName = headerName.substr(0, headerName.length - 1), true) : false;
            if (isAppend || isPrepend) {
                headerValue = [headers.get(headerName) || '', headerValue].filter(v => v);
                headerValue = isPrepend ? headerValue.reverse().join(',') : headerValue.join(',');
            }
            headers.set(headerName, headerValue);
        });
    }

    writeRedirectHeaders(httpEvent, response) {
        const xRedirectPolicy = httpEvent.request.headers.get('X-Redirect-Policy');
        const xRedirectCode = httpEvent.request.headers.get('X-Redirect-Code') || 300;
        const destinationUrl = new URL(response.headers.get('Location'), httpEvent.url.origin);
        const isSameOriginRedirect = destinationUrl.origin === httpEvent.url.origin;
        let isSameSpaRedirect, sparootsFile = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, 'sparoots.json');
        if (isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-spa' && Fs.existsSync(sparootsFile)) {
            // Longest-first sorting
            const sparoots = _arrFrom(JSON.parse(Fs.readFileSync(sparootsFile))).sort((a, b) => a.length > b.length ? -1 : 1);
            const matchRoot = path => sparoots.reduce((prev, root) => prev || (`${path}/`.startsWith(`${root}/`) && root), null);
            isSameSpaRedirect = matchRoot(destinationUrl.pathname) === matchRoot(httpEvent.url.pathname);
        }
        if (xRedirectPolicy === 'manual' || (!isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-origin') || (!isSameSpaRedirect && xRedirectPolicy === 'manual-when-cross-spa')) {
            response.headers.set('X-Redirect-Code', response.status);
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Cache-Control', 'no-store');
            response.meta.status = xRedirectCode;
        }
    }

    createRequest(href, init = {}, autoHeaders = []) {
        const request = new Request(href, init);
        this.writeAutoHeaders(request.headers, autoHeaders);
        return request;
    }

    async navigate(url, init = {}, detail = {}) {
        // Resolve inputs
        const scope = { url, init, detail };
        if (typeof scope.url === 'string') {
            scope.url = new URL(scope.url, 'http://localhost');
        }
        // -----------------
        // Aggregate all hosts and resolve
        const hosts = [];
        this.servers.forEach((server) => hosts.push(...server.domains));
        for (const [ /*id*/, vhost] of this.proxied) {
            if (vhost.hostnames.includes(scope.url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                return await this.proxyFetch(vhost, scope.url, scope.init);
            }
        }
        // -----------------
        // Validate and normalize request
        if (!hosts.includes(scope.url.hostname) && !hosts.includes('*')) {
            scope.exit = { status: 500 };
            scope.exitMessage = 'Unrecognized host';
        } else if (scope.url.protocol === 'http:' && this.cx.server.https.force) {
            scope.exit = {
                status: 302,
                headers: { Location: (scope.url.protocol = 'https:', scope.url.href) }
            };
        } else if (scope.url.hostname.startsWith('www.') && this.cx.server.force_www === 'remove') {
            scope.exit = {
                status: 302,
                headers: { Location: (scope.url.hostname = scope.url.hostname.substr(4), scope.url.href) }
            };
        } else if (!scope.url.hostname.startsWith('www.') && this.cx.server.force_www === 'add') {
            scope.exit = {
                status: 302,
                headers: { Location: (scope.url.hostname = `www.${scope.url.hostname}`, scope.url.href) }
            };
        } else if (this.cx.config.runtime.server.Redirects) {
            scope.exit = ((await (new this.cx.config.runtime.server.Redirects(this.cx)).read()).entries || []).reduce((_rdr, entry) => {
                return _rdr || ((_rdr = pattern(entry.from, scope.url.origin).exec(scope.url.href)) && {
                    status: entry.code || 302,
                    headers: { Location: _rdr.render(entry.to) }
                });
            }, null);
        }
        if (scope.exit) { return new Response(scope.exitMessage, scope.exit); }
        // -----------------
        // Process normally
        scope.autoHeaders = this.cx.config.runtime.server.Headers
            ? ((await (new this.cx.config.runtime.server.Headers(this.cx)).read()).entries || []).filter(entry => pattern(entry.url, url.origin).exec(url.href))
            : [];
        scope.request = this.createRequest(scope.url.href, scope.init, scope.autoHeaders.filter((header) => header.type === 'request'));
        scope.cookieStorage = this.constructor.CookieStorage.create(scope.request);
        scope.sessionStorage = this.constructor.SessionStorage.create(scope.request, { secret: this.cx.env.entries.SESSION_KEY }, this);
        scope.httpEvent = new this.constructor.HttpEvent(scope.request, scope.detail, scope.cookieStorage, scope.sessionStorage);
        scope.response = await this.dispatch(scope.httpEvent, {}, async (event) => {
            return await this.localFetch(event);
        });
        if (scope.response.headers.get('Location')) {
            // Handle redirect. Stop processing there
            this.writeRedirectHeaders(scope.httpEvent, scope.response);
        } else {
            // Write headers
            this.writeAutoHeaders(scope.response.headers, scope.autoHeaders.filter((header) => header.type === 'response'));
            if (scope.httpEvent.request.method !== 'GET' && !scope.response.headers.get('Cache-Control')) {
                scope.response.headers.set('Cache-Control', 'no-store');
            }
            scope.response.headers.set('Accept-Ranges', 'bytes');
            // Satisfy request format
            scope.response = await this.satisfyRequestFormat(scope.httpEvent, scope.response);

        }
        // Logging
        if (this.cx.logger) {
            const log = this.generateLog(scope.httpEvent.request, scope.response);
            this.cx.logger.log(log);
        }
        return scope.response;
    }

    async localFetch(httpEvent) {
        const scope = {};
        scope.filename = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, decodeURIComponent(httpEvent.url.pathname));
        scope.ext = Path.parse(httpEvent.url.pathname).ext;
        // if is a directory search for index file matching the extention
        if (!scope.ext && Fs.existsSync(scope.filename) && Fs.lstatSync(scope.filename).isDirectory()) {
            scope.ext = '.html';
            scope.index = `index${scope.ext}`;
            scope.filename = Path.join(scope.filename, scope.index);
        }
        scope.acceptEncs = [];
        scope.supportedEncs = { gzip: '.gz', br: '.br' };
        // based on the URL path, extract the file extention. e.g. .js, .doc, ...
        // and process encoding
        if ((scope.acceptEncs = (httpEvent.request.headers.get('Accept-Encoding') || '').split(',').map((e) => e.trim())).length
            && (scope.enc = scope.acceptEncs.reduce((prev, _enc) => prev || (Fs.existsSync(scope.filename + scope.supportedEncs[_enc]) && _enc), null))) {
            scope.filename = scope.filename + scope.supportedEncs[scope.enc];
        } else {
            if (!Fs.existsSync(scope.filename)) return;
            if (Object.values(scope.supportedEncs).includes(scope.ext)) {
                scope.enc = Object.keys(scope.supportedEncs).reduce((prev, _enc) => prev || (scope.supportedEncs[_enc] === ext && _enc), null);
                scope.ext = Path.parse(scope.filename.substring(0, scope.filename.length - scope.ext.length)).ext;
            }
        }
        // read file from file system
        return new Promise(resolve => {
            Fs.readFile(scope.filename, function (err, data) {
                if (err) {
                    scope.response = new Response(null, { status: 500, statusText: `Error reading static file: ${scope.filename}` });
                } else {
                    // if the file is found, set Content-type and send data
                    const mime = Mime.lookup(scope.ext);
                    scope.response = new Response(data, {
                        headers: {
                            'Content-Type': mime === 'application/javascript' ? 'text/javascript' : mime,
                            'Content-Length': Buffer.byteLength(data),
                        }
                    });
                    if (scope.enc) {
                        scope.response.headers.set('Content-Encoding', scope.enc);
                    }
                }
                scope.response.meta.filename = scope.filename;
                scope.response.meta.static = true;
                scope.response.meta.index = scope.index;
                resolve(scope.response);
            });
        });
    }

    async remoteFetch(request, ...args) {
        let href = request;
        if (request instanceof Request) {
            href = request.url;
        } else if (request instanceof URL) {
            href = request.href;
        }
        Observer.set(this.network, 'remote', href, { diff: true });
        const _response = xfetch(request, ...args);
        // Save a reference to this
        return _response.then(async response => {
            // Stop loading status
            Observer.set(this.network, 'remote', false, { diff: true });
            return response;
        });
    }

    async proxyFetch(vhost, url, init) {
        // ---------
        const url2 = new URL(url);
        url2.port = vhost.port;
        if (vhost.proto) { url2.protocol = vhost.proto; }
        // ---------
        let init2;
        if (init instanceof Request) {
            init2 = init.clone();
            init.headers.set('Host', url2.host);
        } else {
            init2 = { ...init, decompress: false/* honoured in xfetch() */ };
            if (!init2.headers) init2.headers = {};
            init2.headers.host = url2.host;
            delete init2.headers.connection;
        }
        // ---------
        let response;
        try {
            response = await this.remoteFetch(url2, init2);
        } catch (e) {
            response = new Response(`Reverse Proxy Error: ${e.message}`, { status: 500 });
            console.error(e);
        }
        if (this.cx.logger) {
            const log = this.generateLog({ url: url2.href, ...init2 }, response, true);
            this.cx.logger.log(log);
        }
        return response;
    }

    async satisfyRequestFormat(httpEvent, response) {
        // Satisfy "Accept" header
        if (httpEvent.request.headers.get('Accept')) {
            const requestAccept = httpEvent.request.headers.get('Accept', true);
            if (requestAccept.match('text/html') && !response.meta.static) {
                response = await this.render(httpEvent, response);
            } else if (response.headers.get('Content-Type') && !requestAccept.match(response.headers.get('Content-Type'))) {
                return new Response(response.body, { status: 406, headers: response.headers });
            }
        }
        // Satisfy "Range" header
        if (httpEvent.request.headers.get('Range') && !response.headers.get('Content-Range')
            && (response.body instanceof ReadableStream || ArrayBuffer.isView(response.body))) {
            const rangeRequest = httpEvent.request.headers.get('Range', true);
            const body = _ReadableStream.from(response.body);
            // ...in partials
            const totalLength = parseInt(response.headers.get('Content-Length') || 0);
            const ranges = await rangeRequest.reduce(async (_ranges, range) => {
                _ranges = await _ranges;
                if (range[0] < 0 || (totalLength && range[0] > totalLength)
                    || (range[1] > -1 && (range[1] <= range[0] || (totalLength && range[1] >= totalLength)))) {
                    // The range is beyond upper/lower limits
                    _ranges.error = true;
                }
                if (!totalLength && range[0] === undefined) {
                    // totalLength is unknown and we cant read the trailing size specified in range[1]
                    _ranges.error = true;
                }
                if (_ranges.error) return _ranges;
                if (totalLength) { range.clamp(totalLength); }
                const partLength = range[1] - range[0] + 1;
                _ranges.parts.push({
                    body: body.pipe(_streamSlice(range[0], range[1] + 1)),
                    range: range = `bytes ${range[0]}-${range[1]}/${totalLength || '*'}`,
                    length: partLength,
                });
                _ranges.totalLength += partLength;
                return _ranges;
            }, { parts: [], totalLength: 0 });
            if (ranges.error) {
                response.meta.status = 416;
                response.headers.set('Content-Range', `bytes */${totalLength || '*'}`);
                response.headers.set('Content-Length', 0);
            } else {
                // TODO: of ranges.parts is more than one, return multipart/byteranges
                response = new Response(ranges.parts[0].body, {
                    status: 206,
                    statusText: response.statusText,
                    headers: response.headers,
                });
                response.headers.set('Content-Range', ranges.parts[0].range);
                response.headers.set('Content-Length', ranges.totalLength);
            }
        }
        return response;
    }

    #renderFileCache = new Map;
    async render(httpEvent, response) {
        const scope = {};
        scope.data = await response.parse();
        if (!_isObject(scope.data)) {
            return new Response(scope.data + '', {
                headers: response.headers,
                status: response.status,
            });
        }
        scope.router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
        scope.rendering = await scope.router.route('render', httpEvent, scope.data, async (httpEvent, data) => {
            let renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html'))
                && (this.#renderFileCache.get(renderFile) === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.#renderFileCache.set(renderFile, false);
                pathnameSplit.pop();
            }
            const dirPublic = Url.pathToFileURL(Path.resolve(Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR)));
            const instanceParams = QueryString.stringify({
                file: renderFile,
                url: dirPublic.href,// httpEvent.url.href,
                root: this.cx.CWD,
            });
            const { window, document } = await import('@webqit/oohtml-ssr/src/instance.js?' + instanceParams);
            await new Promise(res => {
                if (document.readyState === 'complete') return res();
                document.addEventListener('load', res);
            });
            if (window.webqit?.oohtml?.configs) {
                const {
                    CONTEXT_API: { attr: contextConfig } = {},
                    BINDINGS_API: { api: bindingsConfig } = {},
                    HTML_IMPORTS: { attr: modulesContextAttrs } = {},
                } = window.webqit.oohtml.configs;
                if (bindingsConfig) {
                    document[bindingsConfig.bind]({
                        env: 'server',
                        location: this.location,
                        network: this.network, // request, error, remote
                        data,
                    }, { diff: true });
                }
                if (modulesContextAttrs) {
                    const newRoute = '/' + `routes/${httpEvent.url.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                    document.body.setAttribute(modulesContextAttrs.importscontext, newRoute);
                }
            }
            if (window.webqit.$qCompilerImport) {
                await new Promise(res => {
                    window.webqit.$qCompilerImport.then(res);
                    setTimeout(res, 300);
                });
            }
            await new Promise(res => setTimeout(res, 50));
            return window;
        });
        // Validate rendering
        if (typeof scope.rendering !== 'string' && !(typeof scope.rendering?.toString === 'function')) {
            throw new Error('render() must return a string response or an object that implements toString()..');
        }
        // Convert back to response
        scope.response = new Response(scope.rendering, {
            headers: response.headers,
            status: response.status,
        });
        scope.response.headers.set('Content-Type', 'text/html');
        scope.response.headers.set('Content-Length', (new Blob([scope.rendering])).size);
        return scope.response;
    }

    generateLog(request, response, isproxy = false) {
        let log = [];
        // ---------------
        const style = this.cx.logger.style || { keyword: str => str, comment: str => str, url: str => str, val: str => str, err: str => str, };
        const errorCode = [404, 500].includes(response.status) ? response.status : 0;
        const xRedirectCode = response.headers.get('X-Redirect-Code');
        const redirectCode = xRedirectCode || ((response.status + '').startsWith('3') ? response.status : 0);
        const statusCode = xRedirectCode || response.status;
        // ---------------
        log.push(`[${style.comment((new Date).toUTCString())}]`);
        log.push(style.keyword(request.method));
        if (isproxy) log.push(style.keyword('>>'));
        log.push(style.url(request.url));
        if (response.meta.hint) log.push(`(${style.comment(response.meta.hint)})`);
        const contentInfo = [response.headers.get('Content-Type'), response.headers.get('Content-Length')].filter(x => x);
        if (contentInfo.length) log.push(`(${style.comment(contentInfo.join('; '))})`);
        if (response.headers.get('Content-Encoding')) log.push(`(${style.comment(response.headers.get('Content-Encoding'))})`);
        if (errorCode) log.push(style.err(`${errorCode} ${response.statusText}`));
        else log.push(style.val(`${statusCode} ${response.statusText}`));
        if (redirectCode) log.push(`- ${style.url(response.headers.get('Location'))}`);

        return log.join(' ');
    }

}

const _streamRead = stream => new Promise(res => {
    let data = '';
    stream.on('data', chunk => data += chunk);
    stream.on('end', () => res(data));
});