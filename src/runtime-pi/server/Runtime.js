
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import Formidable from 'formidable';
import Sessions from 'client-sessions';
import { Observer } from '@webqit/oohtml-ssr/apis.js';
import { _each } from '@webqit/util/obj/index.js';
import { _isEmpty } from '@webqit/util/js/index.js';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { slice as _streamSlice } from 'stream-slice';
import { urlPattern } from '../util.js';
import * as whatwag from './whatwag.js';
import xURL from '../xURL.js';
import xFormData from "../xFormData.js";
import xRequestHeaders from "../xRequestHeaders.js";
import xResponseHeaders from "../xResponseHeaders.js";
import xRequest from "../xRequest.js";
import xResponse from "../xResponse.js";
import xfetch from '../xfetch.js';
import xHttpEvent from '../xHttpEvent.js';

const URL = xURL(whatwag.URL);
const FormData = xFormData(whatwag.FormData);
const ReadableStream = whatwag.ReadableStream;
const RequestHeaders = xRequestHeaders(whatwag.Headers);
const ResponseHeaders = xResponseHeaders(whatwag.Headers);
const Request = xRequest(whatwag.Request, RequestHeaders, FormData, whatwag.Blob);
const Response = xResponse(whatwag.Response, ResponseHeaders, FormData, whatwag.Blob);
const fetch = xfetch(whatwag.fetch);
const HttpEvent = xHttpEvent(Request, Response, URL);

export {
    URL,
    FormData,
    ReadableStream,
    RequestHeaders,
    ResponseHeaders,
    Request,
    Response,
    fetch,
    HttpEvent,
    Observer,
}

export default class Runtime {

    /**
     * Runtime
     * 
     * @param Object        cx
     * @param Function      clientCallback
     * 
     * @return void
     */
    constructor(cx, clientCallback) {
        // ---------------
        this.cx = cx;
        this.clients = new Map;
        this.mockSessionStore = {};
        this.ready = (async () => {

            // ---------------

            const execClientCallback = (cx, hostname) => {
                let client = clientCallback(cx, hostname);
                if (!client || !client.handle) throw new Error(`Application instance must define a ".handle()" method.`);
                return client;
            };
            const loadContextObj = async cx => {
                const meta = {};
                if (_isEmpty(cx.server)) { cx.server = await (new this.cx.config.runtime.Server(cx)).read(); }
                if (_isEmpty(cx.layout)) { cx.layout = await (new this.cx.config.deployment.Layout(cx)).read(); }
                if (_isEmpty(cx.env)) {
                    let env = await (new this.cx.config.deployment.Env(cx)).read();
                    cx.env = env.entries;
                    meta.envAutoloading = env.autoload;
                }
                return meta;
            };
            let loadMeta = await loadContextObj(this.cx);
            if (this.cx.server.shared && (this.cx.config.deployment.Virtualization || !_isEmpty(this.cx.vcontexts))) {
                if (_isEmpty(this.cx.vcontexts)) {
                    this.cx.vcontexts = {};
                    const vhosts = await (new this.cx.config.deployment.Virtualization(cx)).read();
                    await Promise.all((vhosts.entries || []).map(vhost => async () => {
                        this.cx.vcontexts[vhost.host] = this.cx.constructor.create(this.cx, Path.join(this.cx.CWD, vhost.path));
                        await loadContextObj(this.cx.vcontexts[vhost.host]);
                    }));
                }
                _each(this.cx.vcontexts, (host, vcontext) => {
                    this.clients.set(vhost.host, execClientCallback(vcontext, host));
                });
            } else {
                this.clients.set('*', execClientCallback(this.cx, '*'));
            }
            // Always populate... regardless whether shared setup
            if (loadMeta.envAutoloading !== false) {
                Object.keys(this.cx.env).forEach(key => {
                    if (!(key in process.env)) {
                        process.env[key] = this.cx.env[key];
                    }
                });
            }

            // ---------------

            if (!this.cx.flags['test-only'] && !this.cx.flags['https-only']) {
                Http.createServer((request, response) => handleRequest('http', request, response)).listen(process.env.PORT || this.cx.server.port);
            }

            // ---------------

            if (!this.cx.flags['test-only'] && !this.cx.flags['http-only'] && this.cx.server.https.port) {
                const httpsServer = Https.createServer((request, response) => handleRequest('https', request, response));
                if (this.cx.server.shared) {
                    _each(this.cx.vcontexts, (host, vcontext) => {
                        if (Fs.existsSync(vcontext.server.https.keyfile)) {
                            const cert = {
                                key: Fs.readFileSync(vcontext.server.https.keyfile),
                                cert: Fs.readFileSync(vcontext.server.https.certfile),
                            };
                            var domains = _arrFrom(vcontext.server.https.certdoms);
                            if (!domains[0] || domains[0].trim() === '*') {
                                httpsServer.addContext(host, cert);
                                if (vcontext.server.force_www) {
                                    httpsServer.addContext(host.startsWith('www.') ? host.substr(4) : 'www.' + host, cert);
                                }
                            } else {
                                domains.forEach(domain => {
                                    httpsServer.addContext(domain, cert);
                                });
                            }
                        }
                    });
                } else {
                    if (Fs.existsSync(this.cx.server.https.keyfile)) {
                        var domains = _arrFrom(this.cx.server.https.certdoms);
                        var cert = {
                            key: Fs.readFileSync(this.cx.server.https.keyfile),
                            cert: Fs.readFileSync(this.cx.server.https.certfile),
                        };
                        if (!domains[0]) {
                            domains = ['*'];
                        }
                        domains.forEach(domain => {
                            httpsServer.addContext(domain, cert);
                        });
                    }
                }
                httpsServer.listen(process.env.PORT2 || this.cx.server.https.port);
            }

            // ---------------
            
            const handleRequest = async (protocol, request, response) => {
                // --------
                // Parse request
                const fullUrl = protocol + '://' + request.headers.host + request.url;
                const requestInit = { method: request.method, headers: request.headers };
                if (request.method !== 'GET' && request.method !== 'HEAD') {
                    requestInit.body = await new Promise((resolve, reject) => {
                        var formidable = new Formidable.IncomingForm({ multiples: true, allowEmptyFiles: false, keepExtensions: true });
                        formidable.parse(request, (error, fields, files) => {
                            if (error) {
                                reject(error);
                                return;
                            }
                            if (request.headers['content-type'] === 'application/json') {
                                return resolve(fields);
                            }
                            const formData = new FormData;
                            Object.keys(fields).forEach(name => {
                                if (Array.isArray(fields[name])) {
                                    const values = Array.isArray(fields[name][0]) 
                                        ? fields[name][0]/* bugly a nested array when there are actually more than entry */ 
                                        : fields[name];
                                    values.forEach(value => {
                                        formData.append(!name.endsWith(']') ? name + '[]' : name, value);
                                    });
                                } else {
                                    formData.append(name, fields[name]);
                                }
                            });
                            Object.keys(files).forEach(name => {
                                const fileCompat = file => {
                                    // IMPORTANT
                                    // Path up the "formidable" file in a way that "formdata-node"
                                    // to can translate it into its own file instance
                                    file[Symbol.toStringTag] = 'File';
                                    file.stream = () => Fs.createReadStream(file.path);
                                    // Done pathcing
                                    return file;
                                }
                                if (Array.isArray(files[name])) {
                                    files[name].forEach(value => {
                                        formData.append(name, fileCompat(value));
                                    });
                                } else {
                                    formData.append(name, fileCompat(files[name]));
                                }
                            });
                            resolve(formData);
                        });
                    });
                }

                // --------
                // Run Application
                let clientResponse = await this.go(fullUrl, requestInit, { request, response });
                if (response.headersSent) return;

                // --------
                // Set headers
                _each(clientResponse.headers.json(), (name, value) => {
                    response.setHeader(name, value);
                });

                // --------
                // Send
                response.statusCode = clientResponse.status;
                response.statusMessage = clientResponse.statusText;
                if (clientResponse.headers.redirect) {
                    response.end();
                } else {
                    var body = clientResponse.body;
                    if ((body instanceof ReadableStream)) {
                        body.pipe(response);
                    } else {
                        // The default
                        if (clientResponse.headers.contentType === 'application/json') {
                            body += '';
                        }
                        response.end(body);
                    }
                }
            };

        })();
        // ---------------
        Observer.set(this, 'location', {});
        Observer.set(this, 'network', {});
        // ---------------
        this.ready.then(() => {
            if (!this.cx.logger) return;
            if (this.cx.server.shared) {
                this.cx.logger.info(`> Server running (shared)`);
            } else {
                this.cx.logger.info(`> Server running (${this.cx.app.title || ''})::${this.cx.server.port}`);
            }
        });
     }

    /**
     * Performs a request.
     *
     * @param object|string 	url
     * @param object 			init
     * @param object 			detail
     *
     * @return Response
     */
    async go(url, init = {}, detail = {}) {
        await this.ready;

        // ------------
        url = typeof url === 'string' ? new whatwag.URL(url) : url;
        init = { referrer: this.location.href, ...init };
        // ------------
        let _context = this.cx, rdr;
        if (this.cx.server.shared && !(_context = this.cx.vcontexts[url.hostname])
        && !(url.hostname.startsWith('www.') && (_context = this.cx.vcontexts[url.hostname.substr(4)]) && _context.server.force_www)
        && !(!url.hostname.startsWith('www.') && (_context = this.cx.vcontexts['www.' + url.hostname]) && _context.server.force_www)) {
            rdr = { status: 500, statusText: 'Unrecognized host' };
        } else if (url.protocol === 'http:' && _context.server.https.force && !this.cx.flags['http-only'] && /** main server */this.cx.server.https.port) {
            rdr = { status: 302, headers: { Location: ( url.protocol = 'https:', url.href ) } };
        } else if (url.hostname.startsWith('www.') && _context.server.force_www === 'remove') {
            rdr = { status: 302, headers: { Location: ( url.hostname = url.hostname.substr(4), url.href ) } };
        } else if (!url.hostname.startsWith('www.') && _context.server.force_www === 'add') {
            rdr = { status: 302, headers: { Location: ( url.hostname = `www.${url.hostname}`, url.href ) } };
        } else if (_context.config.runtime.server.Redirects) {
            rdr = ((await (new _context.config.runtime.server.Redirects(_context)).read()).entries || []).reduce((_rdr, entry) => {
                return _rdr || ((_rdr = urlPattern(entry.from, url.origin).exec(url.href)) && { status: entry.code || 302, headers: { Location: _rdr.render(entry.to) } });
            }, null);
        }
        if (rdr) {
            return new Response(null, rdr);
        }
        const autoHeaders = _context.config.runtime.server.Headers 
            ? ((await (new _context.config.runtime.server.Headers(_context)).read()).entries || []).filter(entry => urlPattern(entry.url, url.origin).exec(url.href))
            : [];
        // ------------

        // ------------
        Observer.set(this.location, url, { detail: { ...init, ...detail, } });
        Observer.set(this.network, 'redirecting', null);
        // ------------

        // The request object
        let request = this.generateRequest(url.href, init, autoHeaders.filter(header => header.type === 'request'));
        // The navigation event
        let httpEvent = new HttpEvent(request, detail, (id = 'session', options = { duration: 60 * 60 * 24, activeDuration: 60 * 60 * 24 }, callback = null) => {
            return this.getSession(_context, httpEvent, id, options, callback);
        });
        // Response
        let client = this.clients.get('*');
        if (this.cx.server.shared) {
            client = this.clients.get(url.hostname);
        }
        let response = await client.handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
        let finalResponse = await this.handleResponse(_context, httpEvent, response, autoHeaders.filter(header => header.type === 'response'));
        // Logging
        if (this.cx.logger) {
            let log = this.generateLog(httpEvent, finalResponse);
            this.cx.logger.log(log);
        }
        // Return value
        return finalResponse;
    }

    // Generates request object
    generateRequest(href, init, autoHeaders = []) {
        let request = new Request(href, init);
        this._autoHeaders(request.headers, autoHeaders);
        return request;
    }

    // Generates session object
    getSession(cx, e, id, options = {}, callback = null) {
        let baseObject;
        if (!(e.detail.request && e.detail.response)) {
            baseObject = this.mockSessionStore;
            let cookieAvailability = e.request.headers.cookies[id];     // We just want to know availability... not validity, as this is understood to be for testing purposes only
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
        Observer.set(this.network, 'remote', true);
        let _response = fetch(request, ...args);
        // This catch() is NOT intended to handle failure of the fetch
        _response.catch(e => Observer.set(this.network, 'error', e.message));
        // Save a reference to this
        return _response.then(async response => {
            // Stop loading status
            Observer.set(this.network, 'remote', false);
            return new Response(response);
        });
    }

    // Handles response object
    async handleResponse(cx, e, response, autoHeaders = []) {
        if (!(response instanceof Response)) { response = new Response(response); }
        Observer.set(this.network, 'remote', false);
        Observer.set(this.network, 'error', null);

        // ----------------
        // Mock-Cookies?
        if (!(e.detail.request && e.detail.response)) {
            for (let cookieName of Object.getOwnPropertyNames(this.mockSessionStore)) {
                response.headers.set('Set-Cookie', `${cookieName}=1`);      // We just want to know availability... not validity, as this is understood to be for testing purposes only
            }
        }

        // ----------------
        // Auto-Headers
        response.headers.set('Accept-Ranges', 'bytes');
        this._autoHeaders(response.headers, autoHeaders);

        // ----------------
        // Redirects
        if (response.headers.redirect) {
            let xRedirectPolicy = e.request.headers.get('X-Redirect-Policy');
            let xRedirectCode = e.request.headers.get('X-Redirect-Code') || 300;
            let destinationUrl = new whatwag.URL(response.headers.location, e.url.origin);
            let isSameOriginRedirect = destinationUrl.origin === e.url.origin;
            let isSameSpaRedirect, sparootsFile = Path.join(cx.CWD, cx.layout.PUBLIC_DIR, 'sparoots.json');
            if (isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-spa' && Fs.existsSync(sparootsFile)) {
                let sparoots = _arrFrom(JSON.parse(Fs.readFileSync(sparootsFile))).sort((a, b) => a.length > b.length ? 1 : -1);
                let matchRoot = path => sparoots.reduce((prev, root) => prev || (`${path}/`.startsWith(`${root}/`) && root), null);
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
        if (response.bodyAttrs.input === undefined || response.bodyAttrs.input === null) {
            response.attrs.status = response.status !== 200 ? response.status : 404;
            response.attrs.statusText  = `${e.request.url} not found!`;
            return response;
        }

        // ----------------
        // Not acceptable
        if (e.request.headers.get('Accept') && !e.request.headers.accept.match(response.headers.contentType)) {
            response.attrs.status = 406;
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
        && ((body instanceof ReadableStream) || (ArrayBuffer.isView(body) && (body = ReadableStream.from(body))))) {
            // ...in partials
            let totalLength = response.headers.contentLength || 0;
            let ranges = await rangeRequest.reduce(async (_ranges, range) => {
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
                let partLength = range[1] - range[0] + 1;
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
                response = new Response(ranges.parts[0].body, {
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
    generateLog(e, response) {
        let log = [];
        // ---------------
        let style = this.cx.logger.style || { keyword: str => str, comment: str => str, url: str => str, val: str => str, err: str => str, };
        let errorCode = [ 404, 500 ].includes(response.status) ? response.status : 0;
        let xRedirectCode = response.headers.get('X-Redirect-Code');
        let redirectCode = xRedirectCode || ((response.status + '').startsWith('3') ? response.status : 0);
        let statusCode = xRedirectCode || response.status;
        // ---------------
        log.push(`[${style.comment((new Date).toUTCString())}]`);
        log.push(style.keyword(e.request.method));
        log.push(style.url(e.request.url));
        if (response.attrs.hint) log.push(`(${style.comment(response.attrs.hint)})`);
        if (response.headers.contentType) log.push(`(${style.comment(response.headers.contentType)})`);
        if (response.headers.get('Content-Encoding')) log.push(`(${style.comment(response.headers.get('Content-Encoding'))})`);
        if (errorCode) log.push(style.err(`${errorCode} ${response.statusText}`));
        else log.push(style.val(`${statusCode} ${response.statusText}`));
        if (redirectCode) log.push(`- ${style.url(response.headers.redirect)}`);

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