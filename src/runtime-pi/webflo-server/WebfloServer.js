import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import WebSocket from 'ws';
import Mime from 'mime-types';
import 'dotenv/config';
import { Observer } from '@webqit/quantum-js';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { Readable } from 'stream';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { createWindow } from '@webqit/oohtml-ssr';
import { Context } from './Context.js';
import { MessagingOverSocket } from '../webflo-messaging/MessagingOverSocket.js';
import { ClientMessagingRegistry } from './ClientMessagingRegistry.js';
import { ServerSideCookies } from './ServerSideCookies.js';
import { ServerSideSession } from './ServerSideSession.js';
import { HttpEvent } from '../webflo-routing/HttpEvent.js';
import { HttpUser } from '../webflo-routing/HttpUser.js';
import { ServerSideRouter } from './ServerSideRouter.js';
import { meta } from '../webflo-fetch/util.js';
import '../webflo-fetch/index.js';
import '../webflo-url/index.js';

const parseDomains = (domains) => _arrFrom(domains).reduce((arr, str) => arr.concat(str.split(',')), []).map(str => str.trim()).filter(str => str);
const selectDomains = (serverDefs, matchingPort = null) => serverDefs.reduce((doms, def) => doms.length ? doms : (((!matchingPort || def.port === matchingPort) && parseDomains(def.domains || def.hostnames)) || []), []);

export class WebfloServer extends WebfloRuntime {

    static get Context() { return Context; }

    static get Router() { return ServerSideRouter; }

    static get HttpEvent() { return HttpEvent; }

    static get HttpCookies() { return ServerSideCookies; }

    static get HttpSession() { return ServerSideSession; }

    static get HttpUser() { return HttpUser; }

    static create(cx) {
        return new this(this.Context.create(cx));
    }

    #cx;
    #servers = new Map;
    #proxies = new Map;
    #capabilitiesSetup;

    // Typically for access by Router
    get cx() { return this.#cx; }

    #sdk = {};
    get sdk() { return this.#sdk; }

    constructor(cx) {
        super();
        if (!(cx instanceof this.constructor.Context)) {
            throw new Error('Argument #2 must be a Webflo Context instance');
        }
        this.#cx = cx;
    }

    env(key) {
        return key in this.#cx.env.mappings
            ? process.env[this.#cx.env.mappings[key]]
            : process.env[key];
    }

    async initialize() {
        const instanceController = await super.initialize();
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.log('Unhandled Rejection', reason, promise);
        });
        const resolveContextObj = async (cx, force = false) => {
            if (_isEmpty(cx.layout) || force) { cx.layout = await (new cx.config.deployment.Layout(cx)).read(); }
            if (_isEmpty(cx.server) || force) { cx.server = await (new cx.config.runtime.Server(cx)).read(); }
            if (_isEmpty(cx.env) || force) { cx.env = await (new cx.config.deployment.Env(cx)).read(); }
        };
        await resolveContextObj(this.#cx);
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
        await this.setupCapabilities();
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
                for (const [id, def] of this.#proxies) {
                    this.#cx.logger.info(`> ${id} >>> ${def.port}`);
                }
            }
            this.#cx.logger.info(``);
            this.#cx.logger.info(`Capabilities: ${Object.keys(this.#sdk).join(', ')}`);
            this.#cx.logger.info(``);
        }
        return instanceController;
    }

    control() {
        const instanceController = super.control();
        // ---------------
        if (!this.#cx.flags['test-only'] && !this.#cx.flags['https-only'] && this.#cx.server.port) {
            const httpServer = Http.createServer((request, response) => this.handleNodeHttpRequest(request, response));
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
                this.handleNodeWsRequest(wss, request, socket, head);
            });
        }
        // ---------------
        if (!this.#cx.flags['test-only'] && !this.#cx.flags['http-only'] && this.#cx.server.https.port) {
            const httpsServer = Https.createServer((request, response) => this.handleNodeHttpRequest(request, response));
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
                this.handleNodeWsRequest(wss, request, socket, head);
            });
        }
        // ---------------
        const wss = new WebSocket.Server({ noServer: true });
        return instanceController;
    }

    async setupCapabilities() {
        if (this.#capabilitiesSetup) return;
        this.#capabilitiesSetup = true;
        this.#sdk.Observer = Observer;
        if (this.#cx.server.capabilities?.database) {
            if (this.#cx.server.capabilities.database_dialect !== 'postgres') {
                throw new Error(`Only postgres supported for now for database dialect`);
            }
            if (this.env('DATABASE_URL')) {
                const { SQLClient } = await import('@linked-db/linked-ql/sql');
                const { default: pg } = await import('pg');
                // Obtain pg client
                const pgClient = new pg.Pool({
                    connectionString: this.env('DATABASE_URL')
                });
                await (async function connect() {
                    pgClient.on('error', (e) => {
                        console.log('PG Error', e);
                    });
                    pgClient.on('end', (e) => {
                        console.log('PG End', e);
                    });
                    pgClient.on('notice', (e) => {
                        console.log('PG Notice', e);
                    });
                    await pgClient.connect();
                })();
                this.#sdk.db = new SQLClient(pgClient, { dialect: 'postgres' });
            } else {
                //const { ODBClient } = await import('@linked-db/linked-ql/odb');
                //this.#sdk.db = new ODBClient({ dialect: 'postgres' });
            }
        }
        if (this.#cx.server.capabilities?.redis) {
            const { Redis } = await import('ioredis');
            const redis = this.env('REDIS_URL')
                ? new Redis(this.env('REDIS_URL'))
                : new Redis;
            this.#sdk.redis = redis;
            this.#sdk.storage = (namespace, ttl = null) => ({
                async has(key) { return await redis.hexists(namespace, key); },
                async get(key) {
                    const value = await redis.hget(namespace, key);
                    return typeof value === 'undefined' ? value : JSON.parse(value);
                },
                async set(key, value) {
                    const returnValue = await redis.hset(namespace, key, JSON.stringify(value));
                    if (!this.ttlApplied && ttl) {
                        await redis.expire(namespace, ttl);
                        this.ttlApplied = true;
                    }
                    return returnValue;
                },
                async delete(key) { return await redis.hdel(namespace, key); },
                async clear() { return await redis.del(namespace); },
                async keys() { return await redis.hkeys(namespace); },
                async values() { return (await redis.hvals(namespace) || []).map((value) => typeof value === 'undefined' ? value : JSON.parse(value)); },
                async entries() { return Object.entries(await redis.hgetall(namespace) || {}).map(([key, value]) => [key, typeof value === 'undefined' ? value : JSON.parse(value)]); },
                get size() { return redis.hlen(namespace); },
            });
        } else {
            const inmemSessionRegistry = new Map;
            this.#sdk.storage = (namespace) => {
                if (!inmemSessionRegistry.has(namespace)) {
                    inmemSessionRegistry.set(namespace, new Map);
                }
                return inmemSessionRegistry.get(namespace);
            };
        }
        if (this.#cx.server.capabilities?.webpush) {
            const { default: webpush } = await import('web-push');
            this.#sdk.webpush = webpush;
            if (this.env('VAPID_PUBLIC_KEY') && this.env('VAPID_PRIVATE_KEY')) {
                webpush.setVapidDetails(
                    this.#cx.server.capabilities.vapid_subject,
                    this.env('VAPID_PUBLIC_KEY'),
                    this.env('VAPID_PRIVATE_KEY')
                );
            }
        }
    }

    getRequestProto(nodeRequest) {
        return nodeRequest.connection.encrypted ? 'https' : (nodeRequest.headers['x-forwarded-proto'] || 'http');
    }

    #globalMessagingRegistry = new Map;
    async handleNodeWsRequest(wss, nodeRequest, socket, head) {
        const proto = this.getRequestProto(nodeRequest).replace('http', 'ws');
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest, false);
        const scopeObj = {};
        scopeObj.url = new URL(fullUrl);
        // -----------------
        // Level 1 validation
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.domains), []);
        for (const [ /*id*/, vhost] of this.#proxies) {
            if (vhost.hostnames.includes(scopeObj.url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                scopeObj.error = `Web sockets not supported over Webflo reverse proxies`;
                break;
            }
        }
        // -----------------
        // Level 2 validation
        if (!scopeObj.error) {
            if (!hosts.includes(scopeObj.url.hostname) && !hosts.includes('*')) {
                scopeObj.error = 'Unrecognized host';
            } else if (scopeObj.url.protocol === 'ws:' && this.#cx.server.https.port && this.#cx.server.https.force) {
                scopeObj.error = `Only secure connections allowed (wss:)`;
            } else if (scopeObj.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'remove') {
                scopeObj.error = `Connections not allowed over the www subdomain`;
            } else if (!scopeObj.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'add') {
                scopeObj.error = `Connections only allowed over the www subdomain`;
            }
        }
        // -----------------
        // Level 3 validation
        // and actual processing
        scopeObj.request = this.createRequest(scopeObj.url.href, requestInit);

        scopeObj.sessionTTL = this.env('SESSION_TTL') || 2592000/*30days*/;
        scopeObj.session = this.createHttpSession({
            store: (sessionID) => this.#sdk.storage?.(`${scopeObj.url.host}/session:${sessionID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            secret: this.env('SESSION_KEY'),
            ttl: scopeObj.sessionTTL,
        });
        if (!scopeObj.error) {
            if (!(scopeObj.clientMessagingRegistry = this.#globalMessagingRegistry.get(scopeObj.session.sessionID))) {
                scopeObj.error = `Lost or invalid clientID`;
            } else if (!(scopeObj.clientMessagingPort = scopeObj.clientMessagingRegistry.get(scopeObj.url.pathname.split('/').pop()))) {
                scopeObj.error = `Lost or invalid portID`;
            } else {
                wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                    wss.emit('connection', ws, nodeRequest);
                    const wsw = new MessagingOverSocket(null, ws, { honourDoneMutationFlags: true });
                    scopeObj.clientMessagingPort.add(wsw);
                });
            }
        }
        // -----------------
        // Errors?
        if (scopeObj.error) {
            socket.write(
                `HTTP/1.1 400 Bad Request\r\n` +
                `Content-Type: text/plain\r\n` +
                `Connection: close\r\n` +
                `\r\n` +
                `${scopeObj.error}\r\n`
            );
            socket.destroy();
            return;
        }
    }

    async handleNodeHttpRequest(nodeRequest, nodeResponse) {
        const proto = this.getRequestProto(nodeRequest);
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest);
        const scopeObj = {};
        scopeObj.url = new URL(fullUrl);
        // -----------------
        // Level 1 handling
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.domains), []);
        for (const [ /*id*/, vhost] of this.#proxies) {
            if (vhost.hostnames.includes(scopeObj.url.hostname) || (vhost.hostnames.includes('*') && !hosts.includes('*'))) {
                scopeObj.response = await this.proxyFetch(vhost, scopeObj.url, scopeObj.init);
                break;
            }
        }
        // -----------------
        // Level 2 handling
        if (!scopeObj.response) {
            if (!hosts.includes(scopeObj.url.hostname) && !hosts.includes('*')) {
                scopeObj.exit = { status: 500 };
                scopeObj.exitMessage = 'Unrecognized host';
            } else if (scopeObj.url.protocol === 'http:' && this.#cx.server.https.port && this.#cx.server.https.force) {
                scopeObj.exit = {
                    status: 302,
                    headers: { Location: (scopeObj.url.protocol = 'https:', scopeObj.url.href) }
                };
            } else if (scopeObj.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'remove') {
                scopeObj.exit = {
                    status: 302,
                    headers: { Location: (scopeObj.url.hostname = scopeObj.url.hostname.substr(4), scopeObj.url.href) }
                };
            } else if (!scopeObj.url.hostname.startsWith('www.') && this.#cx.server.force_www === 'add') {
                scopeObj.exit = {
                    status: 302,
                    headers: { Location: (scopeObj.url.hostname = `www.${scopeObj.url.hostname}`, scopeObj.url.href) }
                };
            } else if (this.#cx.config.runtime.server.Redirects) {
                scopeObj.exit = ((await (new this.#cx.config.runtime.server.Redirects(this.#cx)).read()).entries || []).reduce((_rdr, entry) => {
                    return _rdr || ((_rdr = (new URLPattern(entry.from, scopeObj.url.origin)).exec(scopeObj.url.href)) && {
                        status: entry.code || 302,
                        headers: { Location: _rdr.render(entry.to) }
                    });
                }, null);
            }
            if (scopeObj.exit) {
                scopeObj.response = new Response(scopeObj.exitMessage, scopeObj.exit);
            }
        }
        // -----------------
        // Level 3 handling
        if (!scopeObj.response) {
            scopeObj.response = await this.navigate(fullUrl, requestInit, {
                request: nodeRequest,
                response: nodeResponse,
                ipAddress: nodeRequest.headers['x-forwarded-for']?.split(',')[0]
                    || nodeRequest.socket.remoteAddress
            });
        }
        // -----------------
        // For when response was sent during this.navigate()
        if (!nodeResponse.headersSent) {
            for (const [name, value] of scopeObj.response.headers) {
                const existing = nodeResponse.getHeader(name);
                if (existing) nodeResponse.setHeader(name, [].concat(existing).concat(value));
                else nodeResponse.setHeader(name, value);
            }
            // --------
            nodeResponse.statusCode = scopeObj.response.status;
            nodeResponse.statusMessage = scopeObj.response.statusText;
            if (scopeObj.response.headers.has('Location')) {
                nodeResponse.end();
            } else if (scopeObj.response.body instanceof Readable) {
                scopeObj.response.body.pipe(nodeResponse);
            } else if (scopeObj.response.body instanceof ReadableStream) {
                Readable.fromWeb(scopeObj.response.body).pipe(nodeResponse);
            } else {
                nodeResponse.end(scopeObj.response.body);
            }
            // -----------------
            // Logging
            if (this.#cx.logger) {
                const log = this.generateLog({ url: fullUrl, method: nodeRequest.method }, scopeObj.response);
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
            nodeRequest[Symbol.toStringTag] = 'ReadableStream'; // Not necessary, but fun
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
            response[meta].status = xRedirectCode;
        }
    }

    createRequest(href, init = {}, autoHeaders = []) {
        const request = super.createRequest(href, init);
        this.writeAutoHeaders(request.headers, autoHeaders);
        return request;
    }

    async proxyFetch(vhost, url, init) {
        const scopeObj = {};
        scopeObj.url = new URL(url);
        scopeObj.url.port = vhost.port;
        if (vhost.proto) {
            scopeObj.url.protocol = vhost.proto;
        }
        // ---------
        if (init instanceof Request) {
            scopeObj.init = init.clone();
            scopeObj.init.headers.set('Host', scopeObj.url.host);
        } else {
            scopeObj.init = { ...init, decompress: false/* honoured in xfetch() */ };
            if (!scopeObj.init.headers) scopeObj.init.headers = {};
            scopeObj.init.headers.host = scopeObj.url.host;
            delete scopeObj.init.headers.connection;
        }
        // ---------
        try {
            scopeObj.response = await this.remoteFetch(scopeObj.url, scopeObj.init);
        } catch (e) {
            scopeObj.response = new Response(`Reverse Proxy Error: ${e.message}`, { status: 500 });
            console.error(e);
        }
        return scopeObj.response;
    }

    async remoteFetch(request, ...args) {
        let href = request;
        if (request instanceof Request) {
            href = request.url;
        } else if (request instanceof URL) {
            href = request.href;
        }
        const _response = fetch(request, ...args);
        // Save a reference to this
        return _response.then(async response => {
            // Stop loading status
            return response;
        });
    }

    async localFetch(httpEvent) {
        const scopeObj = {};
        scopeObj.filename = Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR, decodeURIComponent(httpEvent.url.pathname));
        scopeObj.ext = Path.parse(httpEvent.url.pathname).ext;
        const finalizeResponse = (response) => {
            response[meta].filename = scopeObj.filename;
            response[meta].static = true;
            response[meta].index = scopeObj.index;
            return response;
        };
        // Pre-encoding support?
        if (scopeObj.preEncodingSupportLevel !== 0) {
            scopeObj.acceptEncs = [];
            scopeObj.supportedEncs = { gzip: '.gz', br: '.br' };
            if ((scopeObj.acceptEncs = (httpEvent.request.headers.get('Accept-Encoding') || '').split(',').map((e) => e.trim())).length
                && (scopeObj.enc = scopeObj.acceptEncs.reduce((prev, _enc) => prev || (Fs.existsSync(scopeObj.filename + scopeObj.supportedEncs[_enc]) && _enc), null))) {
                // Route to a pre-compressed version of the file
                scopeObj.filename = scopeObj.filename + scopeObj.supportedEncs[scopeObj.enc];
                scopeObj.stats = null;
            } else if (scopeObj.preEncodingSupportLevel === 2 && Fs.existsSync(scopeObj.filename) && Object.values(scopeObj.supportedEncs).includes(scopeObj.ext)) {
                // If the file is compressed, set the encoding and obtain actual extension
                scopeObj.enc = Object.entries(scopeObj.supportedEncs).find(([, ext]) => ext === scopeObj.ext)[0];
                scopeObj.ext = Path.parse(scopeObj.filename.slice(0, -scopeObj.ext.length)).ext;
            }
        }
        // if is a directory search for index file matching the extention
        if (!scopeObj.ext && scopeObj.autoIndexFileSupport !== false && Fs.existsSync(scopeObj.filename) && (scopeObj.stats = Fs.lstatSync(scopeObj.filename)).isDirectory()) {
            scopeObj.ext = '.html';
            scopeObj.index = `index${scopeObj.ext}`;
            scopeObj.filename = Path.join(scopeObj.filename, scopeObj.index);
            scopeObj.stats = null;
        }
        // File stats and etag
        if (!scopeObj.stats) {
            try { scopeObj.stats = Fs.statSync(scopeObj.filename); } catch (e) {
                if (e.code === 'ENOENT') return finalizeResponse(new Response(null, { status: 404, statusText: 'Not Found' }));
                throw e; // Re-throw other errors
            }
        }
        scopeObj.stats.etag = `W/"${scopeObj.stats.size}-${scopeObj.stats.mtimeMs}"`;
        const ifNoneMatch = httpEvent.request.headers.get('If-None-Match');
        if (scopeObj.stats.etag && ifNoneMatch === scopeObj.stats.etag) {
            return finalizeResponse(new Response(null, { status: 304 }));
        }
        scopeObj.stats.mime = scopeObj.ext && Mime.lookup(scopeObj.ext)?.replace('application/javascript', 'text/javascript') || 'application/octet-stream';
        // Range support
        const readStream = (params = {}) => Fs.createReadStream(scopeObj.filename, { ...params });
        scopeObj.response = this.createStreamingResponse(httpEvent, readStream, scopeObj.stats);
        if (scopeObj.response.status === 416) return finalizeResponse(scopeObj.response);
        // If we reach here, it means we're good
        if (scopeObj.enc) {
            scopeObj.response.headers.set('Content-Encoding', scopeObj.enc);
        }
        // Set common headers
        scopeObj.response.headers.set('ETag', scopeObj.stats.etag);
        scopeObj.response.headers.set('Last-Modified', scopeObj.stats.mtime.toUTCString());
        scopeObj.response.headers.set('Content-Disposition', `inline; filename="${Path.basename(scopeObj.filename)}"`);
        scopeObj.response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
        scopeObj.response.headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
        scopeObj.response.headers.set('X-Content-Type-Options', 'nosniff');
        scopeObj.response.headers.set('Access-Control-Allow-Origin', '*');
        scopeObj.response.headers.set('X-Frame-Options', 'SAMEORIGIN');
        scopeObj.response.headers.set('Accept-Ranges', 'bytes');
        return finalizeResponse(scopeObj.response);
    }

    async navigate(url, init = {}, detail = {}) {
        const scopeObj = { url, init, detail };
        if (typeof scopeObj.url === 'string') {
            scopeObj.url = new URL(scopeObj.url, 'http://localhost');
        }
        // ---------------
        // Request processing
        scopeObj.autoHeaders = this.#cx.config.runtime.server.Headers ? [] : (
            (await (new this.#cx.config.runtime.server.Headers(this.#cx)).read()).entries || []
        ).filter(entry => (new URLPattern(entry.url, url.origin)).exec(url.href));
        scopeObj.request = this.createRequest(scopeObj.url.href, scopeObj.init, scopeObj.autoHeaders.filter((header) => header.type === 'request'));
        scopeObj.cookies = this.createHttpCookies({
            request: scopeObj.request
        });
        scopeObj.sessionTTL = this.env('SESSION_TTL') || 2592000/*30days*/;
        scopeObj.session = this.createHttpSession({
            store: (sessionID) => this.#sdk.storage?.(`${scopeObj.url.host}/session:${sessionID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            secret: this.env('SESSION_KEY'), ttl: scopeObj.sessionTTL
        });
        const sessionID = scopeObj.session.sessionID;
        if (!this.#globalMessagingRegistry.has(sessionID)) {
            this.#globalMessagingRegistry.set(sessionID, new ClientMessagingRegistry(this.#globalMessagingRegistry, sessionID));
        }
        scopeObj.clientMessagingRegistry = this.#globalMessagingRegistry.get(sessionID);
        scopeObj.clientMessagingPort = scopeObj.clientMessagingRegistry.createPort({ url: scopeObj.request.url, honourDoneMutationFlags: true });
        scopeObj.user = this.createHttpUser({
            store: this.#sdk.storage?.(`${scopeObj.url.host}/user:${scopeObj.session.sessionID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            session: scopeObj.session,
            client: scopeObj.clientMessagingPort
        });
        scopeObj.httpEvent = this.createHttpEvent({
            request: scopeObj.request,
            cookies: scopeObj.cookies,
            session: scopeObj.session,
            user: scopeObj.user,
            client: scopeObj.clientMessagingPort,
            detail: scopeObj.detail,
            sdk: this.#sdk,
        });
        // Dispatch for response
        scopeObj.response = await this.dispatchNavigationEvent({
            httpEvent: scopeObj.httpEvent,
            crossLayerFetch: (event) => this.localFetch(event),
            backgroundMessagingPort: `ws:${scopeObj.httpEvent.client.portID}`
        });
        // Reponse handlers
        if (scopeObj.response.headers.get('Location')) {
            this.writeRedirectHeaders(scopeObj.httpEvent, scopeObj.response);
        } else {
            scopeObj.response = await this.satisfyRequestFormat(scopeObj.httpEvent, scopeObj.response);
            this.writeAutoHeaders(scopeObj.response.headers, scopeObj.autoHeaders.filter((header) => header.type === 'response'));
            if (scopeObj.httpEvent.request.method !== 'GET' && !scopeObj.response.headers.get('Cache-Control')) {
                scopeObj.response.headers.set('Cache-Control', 'no-store');
            }
        }
        return scopeObj.response;
    }

    async satisfyRequestFormat(httpEvent, response) {
        if (response.status === 206 || response.status === 416) {
            // If the response is a partial content, we don't need to do anything else
            return response;
        }
        // Satisfy "Accept" header
        const requestAccept = httpEvent.request.headers.get('Accept', true);
        const asHTML = requestAccept?.match('text/html');
        const asIs = requestAccept?.match(response.headers.get('Content-Type'));
        if (requestAccept && asHTML >= asIs && !response[meta].static) {
            response = await this.render(httpEvent, response);
        } else if (requestAccept && response.headers.get('Content-Type') && !asIs) {
            return new Response(response.body, { status: 406, headers: response.headers });
        }
        // Satisfy "Range" header
        const requestRange = httpEvent.request.headers.get('Range', true);
        if (requestRange.length && response.headers.get('Content-Length')) {
            const stats = {
                size: parseInt(response.headers.get('Content-Length')),
                mime: response.headers.get('Content-Type') || 'application/octet-stream',
            };
            const headersBefore = response.headers;
            response = this.createStreamingResponse(
                httpEvent,
                (params) => this.streamSlice(response.body, { ...params }),
                stats
            );
            for (const [name, value] of headersBefore) {
                if (/Content-Length|Content-Type/i.test(name)) continue;
                response.headers.append(name, value);
            }
        }
        return response;
    }

    #renderFileCache = new Map;
    async render(httpEvent, response) {
        const scopeObj = {};
        scopeObj.router = new this.constructor.Router(this.#cx, httpEvent.url.pathname);
        scopeObj.rendering = await scopeObj.router.route('render', httpEvent, async (httpEvent) => {
            let renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html'))
                && (this.#renderFileCache.get(renderFile) === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.#renderFileCache.set(renderFile, false);
                pathnameSplit.pop();
            }
            const dirPublic = Url.pathToFileURL(Path.resolve(Path.join(this.#cx.CWD, this.#cx.layout.PUBLIC_DIR)));
            const instanceParams = /*QueryString.stringify*/({
                //file: renderFile,
                url: dirPublic.href,// httpEvent.url.href,
                root: this.#cx.CWD,
            });
            const { window, document } = createWindow(renderFile, instanceParams);
            //const { window, document } = await import('@webqit/oohtml-ssr/src/instance.js?' + instanceParams);
            await new Promise((res) => {
                if (document.readyState === 'complete') return res(1);
                document.addEventListener('load', res);
            });
            const data = await response.parse();
            if (window.webqit?.oohtml?.configs) {
                // Await rendering engine
                if (window.webqit?.$qCompilerWorker) {
                    window.webqit.$qCompilerWorker.postMessage({ source: '1+1', params: {} }, []);
                    await new Promise(res => {
                        window.webqit.$qCompilerImport.then(res);
                        setTimeout(() => res(1), 1000);
                    });
                }
                const {
                    HTML_IMPORTS: { attr: modulesContextAttrs } = {},
                    BINDINGS_API: { api: bindingsConfig } = {},
                } = window.webqit.oohtml.configs;
                if (modulesContextAttrs) {
                    const newRoute = '/' + `routes/${httpEvent.url.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                    document.body.setAttribute(modulesContextAttrs.importscontext, newRoute);
                }
                if (bindingsConfig) {
                    document[bindingsConfig.bind]({
                        state: {},
                        data,
                        env: 'server',
                        navigator: null,
                        location: this.location,
                        network: null,
                        transition: null,
                        background: null
                    }, { diff: true });
                }
                await new Promise(res => setTimeout(res, 300));
            }
            for (const name of ['X-Background-Messaging-Port', 'X-Live-Response-Frame-Tag', 'X-Live-Response-Generator-Done']) {
                document.querySelector(`meta[name="${name}"]`)?.remove();
                if (!response.headers.get(name)) continue;
                const metaElement = document.createElement('meta');
                metaElement.setAttribute('name', name);
                metaElement.setAttribute('content', response.headers.get(name));
                document.head.prepend(metaElement);
            }
            // Append hydration data
            for (const [rel, content] of [['hydration', data]]) {
                document.querySelector(`script[rel="${rel}"][type="application/json"]`)?.remove();
                const dataScript = document.createElement('script');
                dataScript.setAttribute('type', 'application/json');
                dataScript.setAttribute('rel', rel);
                dataScript.textContent = JSON.stringify(content);
                document.body.append(dataScript);
            }
            const rendering = window.toString();
            document.documentElement.remove();
            document.writeln('');
            try { window.close(); } catch (e) { }
            return rendering;
        });
        // Validate rendering
        if (typeof scopeObj.rendering !== 'string' && !(typeof scopeObj.rendering?.toString === 'function')) {
            throw new Error('render() must return a string response or an object that implements toString()..');
        }
        // Convert back to response
        scopeObj.response = new Response(scopeObj.rendering, {
            headers: response.headers,
            status: response.status,
        });
        scopeObj.response.headers.set('Content-Type', 'text/html');
        scopeObj.response.headers.set('Content-Length', (new Blob([scopeObj.rendering])).size);
        return scopeObj.response;
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
        if (response[meta].hint) log.push(`(${style.comment(response[meta].hint)})`);
        const contentInfo = [response.headers.get('Content-Type'), response.headers.get('Content-Length')].filter(x => x);
        if (contentInfo.length) log.push(`(${style.comment(contentInfo.join('; '))})`);
        if (response.headers.get('Content-Encoding')) log.push(`(${style.comment(response.headers.get('Content-Encoding'))})`);
        if (errorCode) log.push(style.err(`${errorCode} ${response.statusText}`));
        else log.push(style.val(`${statusCode} ${response.statusText}`));
        if (isRedirect) log.push(`- ${style.url(response.headers.get('Location'))}`);

        return log.join(' ');
    }
}