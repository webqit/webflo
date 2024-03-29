
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import Sessions from 'client-sessions';
import { Observer } from '@webqit/oohtml-ssr/apis.js';
import { _each } from '@webqit/util/obj/index.js';
import { _isEmpty } from '@webqit/util/js/index.js';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { slice as _streamSlice } from 'stream-slice';
import { Readable as _ReadableStream } from 'stream';
import { pattern } from '../util-url.js';
import xRequest from "../xRequest.js";
import xResponse from "../xResponse.js";
import xfetch from '../xfetch.js';
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
                const addSSLContext = (serverConfig,  domains) => {
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
                for (const [ /*id*/, vhost ] of this.proxied) {
                    vhost.cx && addSSLContext(vhost.cx.server, vhost.hostnames);
                }
            }
            // ---------------
            const handleRequest = async (proto, request, response) => {
                request[Symbol.toStringTag] = 'ReadableStream';
                const [ fullUrl, requestInit ] = await this.parseNodeRequest(proto, request);
                let clientResponse = await this.go(fullUrl, requestInit, { request, response });
                if (response.headersSent) return;
                // --------
                _each(clientResponse.headers.json(), (name, value) => {
                    response.setHeader(name, value);
                }); 
                // --------
                response.statusCode = clientResponse.status;
                response.statusMessage = clientResponse.statusText;
                if (clientResponse.headers.location) {
                    return response.end();
                }
                if ((clientResponse.body instanceof _ReadableStream)) {
                    return clientResponse.body.pipe(response);
                }
                if ((clientResponse.body instanceof ReadableStream)) {
                    return _ReadableStream.from(clientResponse.body).pipe(response);
                }
                let body = clientResponse.body;
                if (clientResponse.headers.contentType === 'application/json') {
                    body += '';
                }
                return response.end(body);
            };
        })();

        // ---------------
        Observer.set(this, 'location', {});
        Observer.set(this, 'network', {});
        // ---------------

		// -------------
		// Initialize
		(async () => {
            await this.ready;
            if (this.cx.logger) {
                if (this.servers.size) {
                    this.cx.logger.info(`> Server running! (${this.cx.app.title || ''})`);
                    for (let [ proto, def ] of this.servers) {
                        this.cx.logger.info(`> ${ proto.toUpperCase() } / ${ def.domains.concat('').join(`:${ def.port } / `)}`);
                    }
                } else {
                    this.cx.logger.info(`> Server not running! No port specified.`);
                }
                if (this.proxied.size) {
                    this.cx.logger.info(`> Reverse proxy active.`);
                    for (let [ id, def ] of this.proxied) {
                        this.cx.logger.info(`> ${ id } >>> ${ def.port }`);
                    }
                }
                this.cx.logger.info(``);
            }
			if (this.app && this.app.init) {
                const request = this.generateRequest('http://localhost/');
                const httpEvent = new HttpEvent(request, { srcType: 'initialization' }, (id = 'session', options = { duration: 60 * 60 * 24, activeDuration: 60 * 60 * 24 }, callback = null) => {
                    return this.getSession(this.cx, httpEvent, id, options, callback);
                });
                await this.app.init(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
            }
		})();
        // ---------------

        // ---------------
        this.mockSessionStore = {};
        // ---------------
        
    }

    /**
     * Parse Nodejs's IncomingMessage to WHATWAG request params.
     *
     * @param String 	            proto
     * @param Http.IncomingMessage 	request
     *
     * @return Array
     */
    async parseNodeRequest(proto, request) {
        // Detected when using manual proxy setting in a browser
        if (request.url.startsWith(`http://${ request.headers.host }`) || request.url.startsWith(`https://${ request.headers.host }`)) {
            request.url = request.url.split(request.headers.host)[1];
        }
        const fullUrl = proto + '://' + request.headers.host + request.url;
        const requestInit = { method: request.method, headers: request.headers };
        if (!['GET', 'HEAD'].includes(request.method)) {
            requestInit.body = request;
        }
        return [ fullUrl, requestInit ];
    }

    /**
     * Performs a request.
     *
     * @param object|string 	url
     * @param object|Request 	init
     * @param object 			detail
     *
     * @return Response
     */
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
        for (const [ /*id*/, vhost ] of this.proxied) {
            if (vhost.hostnames.includes(url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                return this.proxyGo(vhost, url, init);
            }
        }
        // ------------
        let exit, exitMessage;
        if (!hosts.includes(url.hostname) && !hosts.includes('*')) {
            exit = { status: 500 }, exitMessage = 'Unrecognized host';
        } else if (url.protocol === 'http:' && this.cx.server.https.force) {
            exit = { status: 302, headers: { Location: ( url.protocol = 'https:', url.href ) } };
        } else if (url.hostname.startsWith('www.') && this.cx.server.force_www === 'remove') {
            exit = { status: 302, headers: { Location: ( url.hostname = url.hostname.substr(4), url.href ) } };
        } else if (!url.hostname.startsWith('www.') && this.cx.server.force_www === 'add') {
            exit = { status: 302, headers: { Location: ( url.hostname = `www.${ url.hostname }`, url.href ) } };
        } else if (this.cx.config.runtime.server.Redirects) {
            exit = ((await (new this.cx.config.runtime.server.Redirects(this.cx)).read()).entries || []).reduce((_rdr, entry) => {
                return _rdr || ((_rdr = pattern(entry.from, url.origin).exec(url.href)) && { status: entry.code || 302, headers: { Location: _rdr.render(entry.to) } });
            }, null);
        }
        if (exit) { return new xResponse(exitMessage, exit); }
        // ------------

        // ------------
        Observer.set(this.location, url, { detail: { init, ...detail, } });
        Observer.set(this.network, 'redirecting', null);
        // ------------

        // ------------
        // Automatically-added headers
        const autoHeaders = this.cx.config.runtime.server.Headers 
            ? ((await (new this.cx.config.runtime.server.Headers(this.cx)).read()).entries || []).filter(entry => pattern(entry.url, url.origin).exec(url.href))
            : [];
        // The request object
        const request = this.generateRequest(url.href, init, autoHeaders.filter(header => header.type === 'request'));
        // The navigation event
        const httpEvent = new HttpEvent(request, detail, (id = 'session', options = { duration: 60 * 60 * 24, activeDuration: 60 * 60 * 24 }, callback = null) => {
            return this.getSession(this.cx, httpEvent, id, options, callback);
        });
        // Response
        let response, finalResponse;
        try {
            response = await this.app.handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
            finalResponse = await this.handleResponse(this.cx, httpEvent, response, autoHeaders.filter(header => header.type === 'response'));
        } catch(e) {
            finalResponse = new xResponse(e.message, { status: 500 });
            console.error(e);
        }
        // Logging
        if (this.cx.logger) {
            const log = this.generateLog(httpEvent.request, finalResponse);
            this.cx.logger.log(log);
        }
        // ------------
        // Return value
		return finalResponse;
    }

    // Fetch from proxied host
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
        } catch(e) {
            response = new xResponse(`Reverse Proxy Error: ${e.message}`, { status: 500 });
            console.error(e);
        }
        if (this.cx.logger) {
            const log = this.generateLog({ url: url2.href, ...init2 }, response, true);
            this.cx.logger.log(log);
        }
        return response;

    }


    // Generates request object
    generateRequest(href, init = {}, autoHeaders = []) {
        const request = new xRequest(href, init);
        this._autoHeaders(request.headers, autoHeaders);
        return request;
    }

    // Generates session object
    getSession(cx, e, id, options = {}, callback = null) {
        let baseObject;
        if (!(e.detail.request && e.detail.response)) {
            baseObject = this.mockSessionStore;
            let cookieAvailability = e.request.headers.cookies.get(id);     // We just want to know availability... not validity, as this is understood to be for testing purposes only
            if (!(this.mockSessionStore[id] && cookieAvailability)) {
                let cookieObj = {};
                Object.defineProperty(this.mockSessionStore, id, {
                    get: () => cookieObj,
                    set: value => (cookieObj = value),
                });
            }
        } else {
            Sessions({
                duration: 0,                                            // how long the session will stay valid in ms
                activeDuration: 0,                                      // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
                ...options,
                cookieName: id,                                         // cookie name dictates the key name added to the request object
                secret: cx.env.SESSION_KEY,                             // should be a large unguessable string
            })(e.detail.request, e.detail.response, e => {
                if (e) {
                    if (!callback) throw e;
                    callback(e);
                }
            });
            baseObject = e.detail.request;
        }
        // Where theres no error, instance is available
        let instance = Object.getOwnPropertyDescriptor(baseObject, id);
        if (!callback) return instance;
        if (instance) callback(null, instance);
    }

    // Initiates remote fetch and sets the status
    remoteFetch(request, ...args) {
        let href = request;
		if (request instanceof Request) {
			href = request.url;
		} else if (request instanceof URL) {
			href = request.href;
		}
        Observer.set(this.network, 'remote', href);
        const _response = xfetch(request, ...args);
        // This catch() is NOT intended to handle failure of the fetch
        _response.catch(e => Observer.set(this.network, 'error', e.message));
        // Save a reference to this
        return _response.then(async response => {
            // Stop loading status
            Observer.set(this.network, 'remote', false);
            return xResponse.compat(response);
        });
    }

    // Handles response object
    async handleResponse(cx, e, response, autoHeaders = []) {
        if (!(response instanceof xResponse)) { response = xResponse.compat(response); }
        Observer.set(this.network, 'remote', false);
        Observer.set(this.network, 'error', null);

        // ----------------
        // Mock-Cookies?
        if (!(e.detail.request && e.detail.response)) {
            for (let cookieName of Object.getOwnPropertyNames(this.mockSessionStore)) {
                response.headers.append('Set-Cookie', `${cookieName}=1`);      // We just want to know availability... not validity, as this is understood to be for testing purposes only
            }
        }

        // ----------------
        // Auto-Headers
        response.headers.set('Accept-Ranges', 'bytes');
        this._autoHeaders(response.headers, autoHeaders);

        // ----------------
        // Redirects
        if (response.headers.location) {
            const xRedirectPolicy = e.request.headers.get('X-Redirect-Policy');
            const xRedirectCode = e.request.headers.get('X-Redirect-Code') || 300;
            const destinationUrl = new URL(response.headers.location, e.url.origin);
            const isSameOriginRedirect = destinationUrl.origin === e.url.origin;
            let isSameSpaRedirect, sparootsFile = Path.join(cx.CWD, cx.layout.PUBLIC_DIR, 'sparoots.json');
            if (isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-spa' && Fs.existsSync(sparootsFile)) {
                // Longest-first sorting
                const sparoots = _arrFrom(JSON.parse(Fs.readFileSync(sparootsFile))).sort((a, b) => a.length > b.length ? -1 : 1);
                const matchRoot = path => sparoots.reduce((prev, root) => prev || (`${path}/`.startsWith(`${root}/`) && root), null);
                isSameSpaRedirect = matchRoot(destinationUrl.pathname) === matchRoot(e.url.pathname);
            }
            if (xRedirectPolicy === 'manual' || (!isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-origin') || (!isSameSpaRedirect && xRedirectPolicy === 'manual-when-cross-spa')) {
                response.headers.json({
                    'X-Redirect-Code': response.status,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store',
                });
                response.attrs.status = xRedirectCode;
            }
            return response;
        }

        // ----------------
        // 404
        if (!response.meta.body && response.meta.body !== 0) {
            if (response.status === 200 || response.status === 0) {
                response = new xResponse(response.body, { status: 404, headers: response.headers });
            }
            return response;
        }

        // ----------------
        // Not acceptable
        if (e.request.headers.get('Accept') && !e.request.headers.accept.match(response.headers.contentType)) {
            response = new xResponse(response.body, { status: 406, headers: response.headers });
            return response;
        }

        // ----------------
        // Important no-caching
        // for non-"get" requests
        if (e.request.method !== 'GET' && !response.headers.get('Cache-Control')) {
            response.headers.set('Cache-Control', 'no-store');
        }

        // ----------------
        // Body
        let rangeRequest, body = response.body;
        if ((rangeRequest = e.request.headers.range) && !response.headers.get('Content-Range')
        && ((body instanceof ReadableStream) || (ArrayBuffer.isView(body) && (body = _ReadableStream.from(body))))) {
            // ...in partials
            const totalLength = response.headers.contentLength || 0;
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
                response.attrs.status = 416;
                response.headers.json({
                    'Content-Range': `bytes */${totalLength || '*'}`,
                    'Content-Length': 0,
                });
            } else {
                // TODO: of ranges.parts is more than one, return multipart/byteranges
                response = new xResponse(ranges.parts[0].body, {
                    status: 206,
                    statusText: response.statusText,
                    headers: response.headers,
                });
                response.headers.json({
                    'Content-Range': ranges.parts[0].range,
                    'Content-Length': ranges.totalLength,
                });
            }                
        }

        return response;
    }

    // Generates log
    generateLog(request, response, isproxy = false) {
        let log = [];
        // ---------------
        const style = this.cx.logger.style || { keyword: str => str, comment: str => str, url: str => str, val: str => str, err: str => str, };
        const errorCode = [ 404, 500 ].includes(response.status) ? response.status : 0;
        const xRedirectCode = response.headers.get('X-Redirect-Code');
        const redirectCode = xRedirectCode || ((response.status + '').startsWith('3') ? response.status : 0);
        const statusCode = xRedirectCode || response.status;
        // ---------------
        log.push(`[${style.comment((new Date).toUTCString())}]`);
        log.push(style.keyword(request.method));
        if (isproxy) log.push(style.keyword('>>'));
        log.push(style.url(request.url));
        if (response.attrs.hint) log.push(`(${style.comment(response.attrs.hint)})`);
        const contentInfo = [response.headers.contentType, response.headers.contentLength].filter(x => x);
        if (contentInfo.length) log.push(`(${style.comment(contentInfo.join('; '))})`);
        if (response.headers.get('Content-Encoding')) log.push(`(${style.comment(response.headers.get('Content-Encoding'))})`);
        if (errorCode) log.push(style.err(`${errorCode} ${response.statusText}`));
        else log.push(style.val(`${statusCode} ${response.statusText}`));
        if (redirectCode) log.push(`- ${style.url(response.headers.location)}`);

        return log.join(' ');
    }

    // Applies auto headers
    _autoHeaders(headers, autoHeaders) {
        autoHeaders.forEach(header => {
            var headerName = header.name.toLowerCase(),
                headerValue = header.value,
                isAppend = headerName.startsWith('+') ? (headerName = headerName.substr(1), true) : false,
                isPrepend = headerName.endsWith('+') ? (headerName = headerName.substr(0, headerName.length - 1), true) : false;
            if (isAppend || isPrepend) {
                headerValue = [ headers.get(headerName) || '' , headerValue].filter(v => v);
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