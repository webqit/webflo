import Fs from 'fs';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { slice as _streamSlice } from 'stream-slice';
import { Readable as _ReadableStream } from 'stream';
import { pattern } from '../util-url.js';
import '../util-http.js';
import xfetch from '../xfetch.js';
import Observer from '@webqit/observer';
import CookieStorage from './CookieStorage.js';
import SessionStorage from './SessionStorage.js';
import HttpEvent from '../HttpEvent.js';
import _Runtime from '../Runtime.js';

export {
    //fetch,
    HttpEvent,
    Observer,
}

export default class Runtime extends _Runtime {

    /**
     * Runtime
     * 
     * @param Object        cx
     * @param Function      applicationInstance
     * 
     * @return void
     */
    constructor(cx, applicationInstance) {
        super(cx, applicationInstance);
        // ---------------
        this.ready = (async () => {
            // ---------------
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
            const parseDomains = domains => _arrFrom(domains).reduce((arr, str) => arr.concat(str.split(',')), []).map(str => str.trim()).filter(str => str);
            const selectDomains = (serverDefs, matchingPort = null) => serverDefs.reduce((doms, def) => doms.length ? doms : (((!matchingPort || def.port === matchingPort) && parseDomains(def.domains || def.hostnames)) || []), []);
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
                const [fullUrl, requestInit] = await this.parseNodeRequest(proto, request);
                const clientResponse = await this.go(fullUrl, requestInit, { request, response });
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
        })();

        // ---------------
        Observer.set(this, 'location', {});
        Observer.set(this, 'referrer', {});
        Observer.set(this, 'network', {});
        // ---------------

        // -------------
        // Initialize
        (async () => {
            await this.ready;
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
            if (this.app && this.app.init) {
                const request = this.createRequest('http://localhost/');
                const httpEvent = new HttpEvent(request, { srcType: 'initialization' });
                await this.app.init(httpEvent, (...args) => this.remoteFetch(...args));
            }
        })();
        // ---------------

        // ---------------
        this.mockSessionStore = {};
        // ---------------

    }

    async parseNodeRequest(proto, request) {
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

    createRequest(href, init = {}, autoHeaders = []) {
        const request = new Request(href, init);
        this._autoHeaders(request.headers, autoHeaders);
        return request;
    }

    async go(url, init = {}, detail = {}) {
        await this.ready;

        // ------------
        url = typeof url === 'string' ? new URL(url) : url;
        if (!(init instanceof Request) && !init.referrer) {
            init = { referrer: this.location.href, ...init };
        }
        // ------------
        const hosts = [];
        this.servers.forEach(server => hosts.push(...server.domains));
        // ------------
        for (const [ /*id*/, vhost] of this.proxied) {
            if (vhost.hostnames.includes(url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                return this.proxyGo(vhost, url, init);
            }
        }
        // ------------
        let exit, exitMessage;
        if (!hosts.includes(url.hostname) && !hosts.includes('*')) {
            exit = { status: 500 }, exitMessage = 'Unrecognized host';
        } else if (url.protocol === 'http:' && this.cx.server.https.force) {
            exit = { status: 302, headers: { Location: (url.protocol = 'https:', url.href) } };
        } else if (url.hostname.startsWith('www.') && this.cx.server.force_www === 'remove') {
            exit = { status: 302, headers: { Location: (url.hostname = url.hostname.substr(4), url.href) } };
        } else if (!url.hostname.startsWith('www.') && this.cx.server.force_www === 'add') {
            exit = { status: 302, headers: { Location: (url.hostname = `www.${url.hostname}`, url.href) } };
        } else if (this.cx.config.runtime.server.Redirects) {
            exit = ((await (new this.cx.config.runtime.server.Redirects(this.cx)).read()).entries || []).reduce((_rdr, entry) => {
                return _rdr || ((_rdr = pattern(entry.from, url.origin).exec(url.href)) && { status: entry.code || 302, headers: { Location: _rdr.render(entry.to) } });
            }, null);
        }
        if (exit) { return new Response(exitMessage, exit); }
        // ------------

        // ------------
        Observer.set(this.location, url, { detail: { init, ...detail, } });
        Observer.set(this.network, 'error', null, { diff: true });
        // ------------

        // ------------
        const autoHeaders = this.cx.config.runtime.server.Headers
            ? ((await (new this.cx.config.runtime.server.Headers(this.cx)).read()).entries || []).filter(entry => pattern(entry.url, url.origin).exec(url.href))
            : [];
        const request = this.createRequest(url.href, init, autoHeaders.filter((header) => header.type === 'request'));
        const cookieStorage = CookieStorage.create(request, detail);
        const sessionStorage = SessionStorage.create(request, detail, { secret: this.cx.env.entries.SESSION_KEY });
        const httpEvent = new HttpEvent(request, detail, cookieStorage, sessionStorage);
        // Response
        let response;
        try {
            response = await this.app.handle(httpEvent, (...args) => this.remoteFetch(...args));
            if (typeof response === 'undefined') { response = new Response(null, { status: 404 }); }
            else if (!(response instanceof Response)) response = Response.create(response);
            for (const storage of [cookieStorage, sessionStorage]) {
                storage.commit(response, detail);
            }
            response = await this.encodeRedirect(httpEvent, response, async () => {
                if (httpEvent.request.headers.get('Accept', true).match('text/html') && this.app.render && !response.meta.static) {
                    let rendering;
                    if (response.ok && (!response.meta.type || (response.meta.type === 'json' && typeof response.meta.body === 'object' && response.meta.body))) {
                        rendering = await this.app.render(httpEvent, response);
                    } else if (!response.ok) {
                        if ([404, 500].includes(response.status)) {
                            Observer.set(this.network, 'error', new Error(response.statusText, { cause: response.status }));
                        }
                        rendering = await this.app.render(httpEvent, response);
                    }
                    if (typeof rendering !== 'string' && !(typeof rendering === 'object' && rendering && typeof rendering.toString === 'function')) {
                        throw new Error('render() must return a string response or an object that implements toString()..');
                    }
                    rendering = rendering.toString();
                    response = new Response(rendering, {
                        headers: response.headers,
                        status: response.status,
                    });
                    response.headers.set('Content-Type', 'text/html');
                    response.headers.set('Content-Length', (new Blob([rendering])).size);
                }
                return this.handleResponse2(httpEvent, autoHeaders.filter(header => header.type === 'response'), response);
            });
        } catch (e) {
            response = new Response(e.message, { status: 500 });
            console.error(e);
        }
        // Logging
        if (this.cx.logger) {
            const log = this.generateLog(httpEvent.request, response);
            this.cx.logger.log(log);
        }
        // ------------
        // Return value
        return response;
    }

    async proxyGo(vhost, url, init) {
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

    remoteFetch(request, ...args) {
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

    encodeRedirect(httpEvent, response, callback) {
        // Redirects
        if (response.headers.get('Location')) {
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
            return response;
        }
        return callback();
    }

    async handleResponse2(httpEvent, autoHeaders, response) {
        // Not acceptable
        if (response.headers.get('Content-Type') && httpEvent.request.headers.get('Accept') && !httpEvent.request.headers.get('Accept', true).match(response.headers.get('Content-Type'))) {
            return new Response(response.body, { status: 406, headers: response.headers });
        }
        // Auto-Headers
        this._autoHeaders(response.headers, autoHeaders);
        // Important no-caching
        // for non-"get" requests
        if (httpEvent.request.method !== 'GET' && !response.headers.get('Cache-Control')) {
            response.headers.set('Cache-Control', 'no-store');
        }
        // Body
        response.headers.set('Accept-Ranges', 'bytes');
        let rangeRequest, body = response.body;
        if ((rangeRequest = httpEvent.request.headers.get('Range', true)) && !response.headers.get('Content-Range', true)
            && ((body instanceof ReadableStream) || (ArrayBuffer.isView(body) && (body = _ReadableStream.from(body))))) {
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

    _autoHeaders(headers, autoHeaders) {
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

}

const _streamRead = stream => new Promise(res => {
    let data = '';
    stream.on('data', chunk => data += chunk);
    stream.on('end', () => res(data));
});