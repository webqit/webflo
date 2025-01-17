import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import WebSocket from 'ws';
import Mime from 'mime-types';
import QueryString from 'querystring';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { slice as _streamSlice } from 'stream-slice';
import { Readable as _ReadableStream } from 'stream';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { Context } from './Context.js';
import { CookieStorage } from './CookieStorage.js';
import { SessionStorage } from './SessionStorage.js';
import { MessagingOverSocket } from '../MessagingOverSocket.js';
import { ClientMessagingRegistry } from './ClientMessagingRegistry.js';
import { HttpEvent } from '../HttpEvent.js';
import { HttpUser } from '../HttpUser.js';
import { Router } from './Router.js';
import { pattern } from '../util-url.js';
import xfetch from '../xfetch.js';
import '../util-http.js';

const parseDomains = (domains) => _arrFrom(domains).reduce((arr, str) => arr.concat(str.split(',')), []).map(str => str.trim()).filter(str => str);
const selectDomains = (serverDefs, matchingPort = null) => serverDefs.reduce((doms, def) => doms.length ? doms : (((!matchingPort || def.port === matchingPort) && parseDomains(def.domains || def.hostnames)) || []), []);

export class WebfloServer extends WebfloRuntime {

    static get Context() { return Context; }

    static get Router() { return Router; }

    static get HttpEvent() { return HttpEvent; }

    static get CookieStorage() { return CookieStorage; }

    static get SessionStorage() { return SessionStorage; }

    static get HttpUser() { return HttpUser; }

    static create(cx) {
        return new this(this.Context.create(cx));
    }

    #cx;
    #servers = new Map;
    #proxies = new Map;
    #sockets = new Map;

    // Typically for access by Router
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
        await resolveContextObj(this.#cx);
        if (this.#cx.env.autoload !== false) {
            Object.keys(this.#cx.env.entries).forEach(key => {
                if (!(key in process.env)) {
                    process.env[key] = this.#cx.env.entries[key];
                }
            });
        }
        // ---------------
        if (this.#cx.config.deployment.Proxy) {
            const proxied = await (new this.#cx.config.deployment.Proxy(this.#cx)).read();
            await Promise.all((proxied.entries || []).map(async vhost => {
                let cx, hostnames = parseDomains(vhost.hostnames), port = vhost.port, proto = vhost.proto;
                if (vhost.path) {
                    cx = this.#cx.constructor.create(this.#cx, Path.join(this.#cx.CWD, vhost.path));
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
                this.#proxies.set(hostnames.sort().join('|'), { cx, hostnames, port, proto });
            }));
        }
        // ---------------
        this.control();
        if (this.#cx.logger) {
            if (this.#servers.size) {
                this.#cx.logger.info(`> Server running! (${this.#cx.app.title || ''})`);
                for (let [proto, def] of this.#servers) {
                    this.#cx.logger.info(`> ${proto.toUpperCase()} / ${def.domains.concat('').join(`:${def.port} / `)}`);
                }
            } else {
                this.#cx.logger.info(`> Server not running! No port specified.`);
            }
            if (this.#proxies.size) {
                this.#cx.logger.info(`> Reverse proxy active.`);
                for (let [id, def] of this.#proxies) {
                    this.#cx.logger.info(`> ${id} >>> ${def.port}`);
                }
            }
            this.#cx.logger.info(``);
        }
    }

    control() {
        // ---------------
        if (!this.#cx.flags['test-only'] && !this.#cx.flags['https-only'] && this.#cx.server.port) {
            const httpServer = Http.createServer((request, response) => this.handleNodeHttpRequest('http', request, response));
            httpServer.listen(this.#cx.server.port);
            // -------
            let domains = parseDomains(this.#cx.server.domains);
            if (!domains.length) { domains = ['*']; }
            this.#servers.set('http', {
                instance: httpServer,
                port: this.#cx.server.port,
                domains,
            });
            // Handle WebSocket connections
            httpServer.on('upgrade', (request, socket, head) => {
                this.handleNodeWsRequest(wss, 'ws', request, socket, head);
            });
        }
        // ---------------
        if (!this.#cx.flags['test-only'] && !this.#cx.flags['http-only'] && this.#cx.server.https.port) {
            const httpsServer = Https.createServer((request, response) => this.handleNodeHttpRequest('https', request, response));
            httpsServer.listen(this.#cx.server.https.port);
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
            let domains = parseDomains(this.#cx.server.https.domains);
            if (!domains.length) { domains = ['*']; }
            this.#servers.set('https', {
                instance: httpsServer,
                port: this.#cx.server.https.port,
                domains,
            });
            // -------
            addSSLContext(this.#cx.server, domains);
            for (const [ /*id*/, vhost] of this.#proxies) {
                vhost.cx && addSSLContext(vhost.cx.server, vhost.hostnames);
            }
            // Handle WebSocket connections
            httpsServer.on('upgrade', (request, socket, head) => {
                this.handleNodeWsRequest(wss, 'wss', request, socket, head);
            });
        }
        // ---------------
        const wss = new WebSocket.Server({ noServer: true });
    }

    #globalMessagingRegistry = new Map;
    async handleNodeWsRequest(wss, proto, nodeRequest, socket, head) {
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest, false);
        const scope = {};
        scope.url = new URL(fullUrl);
        // -----------------
        // Level 1 validation
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.domains), []);
        for (const [ /*id*/, vhost] of this.#proxies) {
            if (vhost.hostnames.includes(scope.url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                scope.error = `Web sockets not supported over Webflo reverse proxies`;
                break;
            }
        }
        // -----------------
        // Level 2 validation
        if (!scope.error) {
            if (!hosts.includes(scope.url.hostname) && !hosts.includes('*')) {
                scope.error = 'Unrecognized host';
            } else if (scope.url.protocol === 'ws:' && this.#cx.server.https.force) {
                scope.error = `Only secure connections allowed (wss:)`;
            } else if (scope.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'remove') {
                scope.error = `Connections not allowed over the www subdomain`;
            } else if (!scope.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'add') {
                scope.error = `Connections only allowed over the www subdomain`;
            }
        }
        // -----------------
        // Level 3 validation
        // and actual processing
        scope.request = this.createRequest(scope.url.href, requestInit);
        scope.session = this.constructor.SessionStorage.create(scope.request, { secret: this.#cx.env.entries.SESSION_KEY });
        if (!scope.error) {
            if (!(scope.clientMessagingRegistry = this.#globalMessagingRegistry.get(scope.session.sessionID))) {
                scope.error = `Lost or invalid clientID`;
            } else if (!(scope.clientMessaging = scope.clientMessagingRegistry.get(scope.url.pathname.split('/').pop()))) {
                scope.error = `Lost or invalid portID`;
            } else {
                wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                    wss.emit('connection', ws, nodeRequest);
                    const wsw = new MessagingOverSocket(null, ws);
                    scope.clientMessaging.add(wsw);
                });
            }
        }
        // -----------------
        // Errors?
        if (scope.error) {
            socket.write(
                `HTTP/1.1 400 Bad Request\r\n` +
                `Content-Type: text/plain\r\n` +
                `Connection: close\r\n` +
                `\r\n` +
                `${scope.error}\r\n`
            );
            socket.destroy();
            return;
        }
    }

    async handleNodeHttpRequest(proto, nodeRequest, nodeResponse) {
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest);
        const scope = {};
        scope.url = new URL(fullUrl);
        // -----------------
        // Level 1 handling
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.domains), []);
        for (const [ /*id*/, vhost] of this.#proxies) {
            if (vhost.hostnames.includes(scope.url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                scope.response = await this.proxyFetch(vhost, scope.url, scope.init);
                break;
            }
        }
        // -----------------
        // Level 2 handling
        if (!scope.response) {
            if (!hosts.includes(scope.url.hostname) && !hosts.includes('*')) {
                scope.exit = { status: 500 };
                scope.exitMessage = 'Unrecognized host';
            } else if (scope.url.protocol === 'http:' && this.#cx.server.https.force) {
                scope.exit = {
                    status: 302,
                    headers: { Location: (scope.url.protocol = 'https:', scope.url.href) }
                };
            } else if (scope.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'remove') {
                scope.exit = {
                    status: 302,
                    headers: { Location: (scope.url.hostname = scope.url.hostname.substr(4), scope.url.href) }
                };
            } else if (!scope.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'add') {
                scope.exit = {
                    status: 302,
                    headers: { Location: (scope.url.hostname = `www.${scope.url.hostname}`, scope.url.href) }
                };
            } else if (this.#cx.config.runtime.server.Redirects) {
                scope.exit = ((await (new this.#cx.config.runtime.server.Redirects(this.#cx)).read()).entries || []).reduce((_rdr, entry) => {
                    return _rdr || ((_rdr = pattern(entry.from, scope.url.origin).exec(scope.url.href)) && {
                        status: entry.code || 302,
                        headers: { Location: _rdr.render(entry.to) }
                    });
                }, null);
            }
            if (scope.exit) {
                scope.response = new Response(scope.exitMessage, scope.exit);
            }
        }
        // -----------------
        // Level 3 handling
        if (!scope.response) {
            scope.response = await this.navigate(fullUrl, requestInit, {
                request: nodeRequest,
                response: nodeResponse
            });
        }
        // -----------------
        // For when response was sent during this.navigate()
        if (!nodeResponse.headersSent) {
            for (const [name, value] of scope.response.headers) {
                const existing = nodeResponse.getHeader(name);
                if (existing) nodeResponse.setHeader(name, [].concat(existing).concat(value));
                else nodeResponse.setHeader(name, value);
            }
            // --------
            nodeResponse.statusCode = scope.response.status;
            nodeResponse.statusMessage = scope.response.statusText;
            if (scope.response.headers.has('Location')) {
                nodeResponse.end();
            } else if (scope.response.body instanceof _ReadableStream) {
                scope.response.body.pipe(nodeResponse);
            } else if (scope.response.body instanceof ReadableStream) {
                _ReadableStream.from(scope.response.body).pipe(nodeResponse);
            } else {
                let body = scope.response.body;
                if (scope.response.headers.get('Content-Type') === 'application/json') {
                    body += '';
                }
                nodeResponse.end(body);
            }
            // -----------------
            // Logging
            if (this.#cx.logger) {
                const log = this.generateLog({ url: fullUrl, method: nodeRequest.method }, scope.response);
                this.#cx.logger.log(log);
            }
        }
    }

    parseNodeRequest(proto, nodeRequest, withBody = true) {
        // Detected when using manual proxy setting in a browser
        if (nodeRequest.url.startsWith(`${proto}://${nodeRequest.headers.host}`)) {
            nodeRequest.url = nodeRequest.url.split(nodeRequest.headers.host)[1];
        }
        const fullUrl = proto + '://' + nodeRequest.headers.host + nodeRequest.url;
        const requestInit = { method: nodeRequest.method, headers: nodeRequest.headers };
        if (withBody && !['GET', 'HEAD'].includes(nodeRequest.method)) {
            nodeRequest[Symbol.toStringTag] = 'ReadableStream';
            requestInit.body = nodeRequest;
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
        let isSameSpaRedirect, sparootsFile = Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR, 'sparoots.json');
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

    async proxyFetch(vhost, url, init) {
        const scope = {};
        scope.url = new URL(url);
        scope.url.port = vhost.port;
        if (vhost.proto) {
            scope.url.protocol = vhost.proto;
        }
        // ---------
        if (init instanceof Request) {
            scope.init = init.clone();
            scope.init.headers.set('Host', scope.url.host);
        } else {
            scope.init = { ...init, decompress: false/* honoured in xfetch() */ };
            if (!scope.init.headers) scope.init.headers = {};
            scope.init.headers.host = scope.url.host;
            delete scope.init.headers.connection;
        }
        // ---------
        try {
            scope.response = await this.remoteFetch(scope.url, scope.init);
        } catch (e) {
            scope.response = new Response(`Reverse Proxy Error: ${e.message}`, { status: 500 });
            console.error(e);
        }
        return scope.response;
    }

    async remoteFetch(request, ...args) {
        let href = request;
        if (request instanceof Request) {
            href = request.url;
        } else if (request instanceof URL) {
            href = request.href;
        }
        const _response = xfetch(request, ...args);
        // Save a reference to this
        return _response.then(async response => {
            // Stop loading status
            return response;
        });
    }

    async localFetch(httpEvent) {
        const scope = {};
        scope.filename = Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR, decodeURIComponent(httpEvent.url.pathname));
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
            if (!Fs.existsSync(scope.filename)) 
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

    async navigate(url, init = {}, detail = {}) {
        const scope = { url, init, detail };
        if (typeof scope.url === 'string') {
            scope.url = new URL(scope.url, 'http://localhost');
        }
        scope.response = await new Promise(async (resolveResponse) => {
            scope.handleRespondWith = async (response) => {
                if (scope.finalResponseSeen) {
                    throw new Error('Final response already sent');
                }
                if (scope.initialResponseSeen) {
                    return await this.execPush(scope.clientMessaging, response);
                }
                resolveResponse(response);
            };
            // ---------------
            // Request processing
            scope.autoHeaders = this.#cx.config.runtime.server.Headers
                ? ((await (new this.#cx.config.runtime.server.Headers(this.#cx)).read()).entries || []).filter(entry => pattern(entry.url, url.origin).exec(url.href))
                : [];
            scope.request = this.createRequest(scope.url.href, scope.init, scope.autoHeaders.filter((header) => header.type === 'request'));
            scope.cookies = this.constructor.CookieStorage.create(scope.request);
            scope.session = this.constructor.SessionStorage.create(scope.request, { secret: this.#cx.env.entries.SESSION_KEY });
            const sessionID = scope.session.sessionID;
            if (!this.#globalMessagingRegistry.has(sessionID)) {
                this.#globalMessagingRegistry.set(sessionID, new ClientMessagingRegistry(this, sessionID));
            }
            scope.clientMessagingRegistry = this.#globalMessagingRegistry.get(sessionID);
            scope.clientMessaging = scope.clientMessagingRegistry.createPort();
            scope.user = this.constructor.HttpUser.create(
                scope.request, 
                scope.session, 
                scope.clientMessaging
            );
            scope.httpEvent = this.constructor.HttpEvent.create(scope.handleRespondWith, {
                request: scope.request,
                detail: scope.detail,
                cookies: scope.cookies,
                session: scope.session,
                user: scope.user,
                client: scope.clientMessaging
            });
            // Restore session before dispatching
            if (scope.request.method === 'GET' 
            && (scope.redirectMessageID = scope.httpEvent.url.query['redirect-message'])
            && (scope.redirectMessage = scope.session.get(`redirect-message:${scope.redirectMessageID}`))) {
                console.log('______', scope.redirectMessage);
                scope.session.delete(`redirect-message:${scope.redirectMessageID}`);
            }
            // Dispatch for response
            scope.$response = await this.dispatch(scope.httpEvent, {}, async (event) => {
                return await this.localFetch(event);
            });
            // Final reponse!!!
            scope.finalResponseSeen = true;
            if (scope.initialResponseSeen) {
                // Send via background port
                if (typeof scope.$response !== 'undefined') {
                    await this.execPush(scope.clientMessaging, scope.$response);
                }
                scope.clientMessaging.close();
                return;
            }
            // Send normally
            resolveResponse(scope.$response);
        });
        scope.initialResponseSeen = true;
        if (!scope.finalResponseSeen || scope.redirectMessage) {
            scope.hasBackgroundActivity = true;
        }
        scope.response = await this.normalizeResponse(scope.httpEvent, scope.response, scope.hasBackgroundActivity);
        if (scope.hasBackgroundActivity) {
            scope.response.headers.set('X-Background-Messaging', `ws:${scope.clientMessaging.portID}`);
        } else {
            scope.clientMessaging.close();
        }
        // Reponse handlers
        if (scope.response.headers.get('Location')) {
            this.writeRedirectHeaders(scope.httpEvent, scope.response);
        } else {
            this.writeAutoHeaders(scope.response.headers, scope.autoHeaders.filter((header) => header.type === 'response'));
            if (scope.httpEvent.request.method !== 'GET' && !scope.response.headers.get('Cache-Control')) {
                scope.response.headers.set('Cache-Control', 'no-store');
            }
            scope.response.headers.set('Accept-Ranges', 'bytes');
            scope.response = await this.satisfyRequestFormat(scope.httpEvent, scope.response);
        }
        if (scope.redirectMessage) {
            setTimeout(() => {
                this.execPush(scope.clientMessaging, scope.redirectMessage);
                if (scope.finalResponseSeen) {
                    scope.clientMessaging.close();
                }
            }, 500);
        } else if (scope.finalResponseSeen) {
            scope.clientMessaging.close();
        }
        return scope.response;
    }

    async satisfyRequestFormat(httpEvent, response) {
        if (response.status === 404) return response;
        // Satisfy "Accept" header
        const acceptedOrUnchanged = [202/*Accepted*/, 304/*Not Modified*/].includes(response.status);
        if (httpEvent.request.headers.get('Accept')) {
            const requestAccept = httpEvent.request.headers.get('Accept', true);
            if (requestAccept.match('text/html') && !response.meta.static) {
                const data = acceptedOrUnchanged ? {} : await response.parse();
                response = await this.render(httpEvent, data, response);
            } else if (acceptedOrUnchanged) {
                return response;
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
    async render(httpEvent, data, response) {
        const scope = {};
        scope.router = new this.constructor.Router(this.#cx, httpEvent.url.pathname);
        scope.rendering = await scope.router.route('render', httpEvent, data, async (httpEvent, data) => {
            let renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html'))
                && (this.#renderFileCache.get(renderFile) === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.#renderFileCache.set(renderFile, false);
                pathnameSplit.pop();
            }
            const dirPublic = Url.pathToFileURL(Path.resolve(Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR)));
            const instanceParams = QueryString.stringify({
                file: renderFile,
                url: dirPublic.href,// httpEvent.url.href,
                root: this.#cx.CWD,
            });
            const { window, document } = await import('@webqit/oohtml-ssr/src/instance.js?' + instanceParams);
            await new Promise(res => {
                if (document.readyState === 'complete') return res();
                document.addEventListener('load', res);
            });
            if (window.webqit?.oohtml?.configs) {
                const {
                    BINDINGS_API: { api: bindingsConfig } = {},
                    HTML_IMPORTS: { attr: modulesContextAttrs } = {},
                } = window.webqit.oohtml.configs;
                if (bindingsConfig) {
                    document[bindingsConfig.bind]({
                        ...(!_isObject(data) ? {} : data),
                        env: 'server',
                        navigator: null,
                        location: this.location,
                        network: null,
                        transition: null,
                        background: null
                    }, { diff: true });
                    let overridenKeys;
                    if (_isObject(data) && (overridenKeys = ['env', 'navigator', 'location', 'network', 'transition', 'background'].filter((k) => k in data)).length) {
                        console.error(`The following data properties were overridden: ${overridenKeys.join(', ')}`);
                    }
                }
                if (modulesContextAttrs) {
                    const newRoute = '/' + `routes/${httpEvent.url.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                    document.body.setAttribute(modulesContextAttrs.importscontext, newRoute);
                }
            }
            // Append background-activity meta
            let backgroundActivityMeta = document.querySelector('meta[name="X-Background-Messaging"]');
            if (response.headers.has('X-Background-Messaging')) {
                if (!backgroundActivityMeta) {
                    backgroundActivityMeta = document.createElement('meta');
                    backgroundActivityMeta.setAttribute('name', 'X-Background-Messaging');
                    document.head.prepend(backgroundActivityMeta);
                }
                backgroundActivityMeta.setAttribute('content', response.headers.get('X-Background-Messaging'));
            } else if (backgroundActivityMeta) {
                backgroundActivityMeta.remove();
            }
            // Append hydration data
            const hydrationData = document.querySelector('script[rel="hydration"][type="application/json"]') || document.createElement('script');
            hydrationData.setAttribute('type', 'application/json');
            hydrationData.setAttribute('rel', 'hydration');
            hydrationData.textContent = JSON.stringify(data);
            document.body.append(hydrationData);
            // Await rendering engine
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
        const style = this.#cx.logger.style || { keyword: str => str, comment: str => str, url: str => str, val: str => str, err: str => str, };
        const errorCode = [404, 500].includes(response.status) ? response.status : 0;
        const xRedirectCode = response.headers.get('X-Redirect-Code');
        const isRedirect = xRedirectCode || (response.status + '').startsWith('3');
        const statusCode = xRedirectCode && `${xRedirectCode} (${response.status})` || response.status;
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
        if (isRedirect) log.push(`- ${style.url(response.headers.get('Location'))}`);

        return log.join(' ');
    }

}

const _streamRead = stream => new Promise(res => {
    let data = '';
    stream.on('data', chunk => data += chunk);
    stream.on('end', () => res(data));
});