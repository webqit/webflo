import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import WebSocket from 'ws';
import Mime from 'mime-types';
import 'dotenv/config';
import { Readable } from 'stream';
import { Observer } from '@webqit/quantum-js';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { WebfloHMR } from './webflo-devmode.js';
import { Tenants } from './messaging/Tenants.js';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { MessagingOverSocket } from '../webflo-messaging/MessagingOverSocket.js';
import { ServerSideCookies } from './ServerSideCookies.js';
import { ServerSideSession } from './ServerSideSession.js';
import { HttpEvent } from '../webflo-routing/HttpEvent.js';
import { HttpUser } from '../webflo-routing/HttpUser.js';
import { createWindow } from '@webqit/oohtml-ssr';
import {
    readServerConfig,
    readHeadersConfig,
    readRedirectsConfig,
    readLayoutConfig,
    readEnvConfig,
    readProxyConfig,
    scanRoots,
    scanRouteHandlers,
} from '../../deployment-pi/util.js';
import { _wq } from '../../util.js';
import '../webflo-fetch/index.js';
import '../webflo-url/index.js';

export class WebfloServer extends WebfloRuntime {

    static get HttpEvent() { return HttpEvent; }

    static get HttpCookies() { return ServerSideCookies; }

    static get HttpSession() { return ServerSideSession; }

    static get HttpUser() { return HttpUser; }

    static create(cx) {
        return new this(this.Context.create(cx));
    }

    #config;
    get config() { return this.#config; }

    #routes;
    get routes() { return this.#routes; }

    #sdk = {};
    get sdk() { return this.#sdk; }

    #servers = new Map;

    #tenants;

    #hmrRegistry;

    env(key) {
        const { ENV } = this.config;
        return key in ENV.mappings
            ? process.env[ENV.mappings[key]]
            : process.env[key];
    }

    async initialize() {
        const instanceController = await super.initialize();
        const { app: APP, flags: FLAGS, logger: LOGGER, } = this.cx;
        this.#config = {
            LAYOUT: await readLayoutConfig(this.cx),
            ENV: await readEnvConfig(this.cx),
            SERVER: await readServerConfig(this.cx),
            HEADERS: await readHeadersConfig(this.cx),
            REDIRECTS: await readRedirectsConfig(this.cx),
            PROXY: await readProxyConfig(this.cx),
        };
        const { PROXY } = this.config;
        if (FLAGS['dev']) {
            this.#config.DEV_DIR = Path.join(process.cwd(), '.webqit/webflo/@dev');
            this.#config.DEV_LAYOUT = { ...this.config.LAYOUT };
            for (const name of ['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'VIEWS_DIR', 'PUBLIC_DIR']) {
                const originalDir = Path.relative(process.cwd(), this.config.LAYOUT[name]);
                this.config.DEV_LAYOUT[name] = `${this.#config.DEV_DIR}/${originalDir}`;
            }
            await this.enterDevMode();
        }
        // -----------------
        this.#routes = {};
        const spaRoots = scanRoots(this.config.LAYOUT.PUBLIC_DIR, 'index.html');
        const serverRoots = PROXY.entries.map((proxy) => proxy.path?.replace(/^\.\//, '')).filter((p) => p);
        scanRouteHandlers(this.#config.DEV_LAYOUT || this.#config.LAYOUT, 'server', (file, route) => {
            this.routes[route] = file;
        }, ''/*offset*/, serverRoots);
        Object.defineProperty(this.#routes, '$root', { value: '' });
        Object.defineProperty(this.#routes, '$sparoots', { value: spaRoots });
        Object.defineProperty(this.#routes, '$serverroots', { value: serverRoots });
        // -----------------
        await this.setupCapabilities();
        this.#tenants = new Tenants(this);
        this.control();
        /* Example usage
        this.#tenants.addEventListener('navigate', (e) => {
            e// -> SocketMessageEvent
                .originalTarget// -> MessagingOverSocket
                    [$parentNode]// -> ClientMessagePort (.add, .remove, .find())
                        [$parentNode]// -> Tenant (.add, .remove, .find())
                            [$parentNode]// -> tenants (.add, .remove, .find())
        });
        */
        // -----------------
        if (LOGGER) {
            if (this.#servers.size) {
                LOGGER.info(`> Server running! (${APP.title || ''})`);
                for (let [proto, def] of this.#servers) {
                    LOGGER.info(`> ${proto.toUpperCase()} / ${def.hostnames.concat('').join(`:${def.port} / `)}`);
                }
            } else {
                LOGGER.info(`> Server not running! No port specified.`);
            }
            if (PROXY.entries.length) {
                LOGGER.info(`> Reverse proxy active.`);
                for (const proxy of PROXY.entries) {
                    LOGGER.info(`> ${proxy.hostnames.join('|')} >>> ${proxy.port}`);
                }
            }
            LOGGER.info(``);
            LOGGER.info(`Capabilities: ${Object.keys(this.#sdk).join(', ')}`);
            LOGGER.info(``);
        }
        return instanceController;
    }

    async setupCapabilities() {
        const instanceController = await super.setupCapabilities();
        const { SERVER } = this.config;
        this.#sdk.Observer = Observer;
        // 1. Database capabilities?
        if (SERVER.capabilities?.database) {
            if (SERVER.capabilities.database_dialect !== 'postgres') {
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
        // 2. Storage capabilities?
        if (SERVER.capabilities?.redis) {
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
        // 3. webpush capabilities?
        if (SERVER.capabilities?.webpush) {
            const { default: webpush } = await import('web-push');
            this.#sdk.webpush = webpush;
            if (this.env('VAPID_PUBLIC_KEY') && this.env('VAPID_PRIVATE_KEY')) {
                webpush.setVapidDetails(
                    SERVER.capabilities.vapid_subject,
                    this.env('VAPID_PUBLIC_KEY'),
                    this.env('VAPID_PRIVATE_KEY')
                );
            }
        }
        return instanceController;
    }

    async enterDevMode() {
        this.#hmrRegistry = WebfloHMR.manage(this);
        await this.#hmrRegistry.buildJS(true);
    }

    control() {
        const { flags: FLAGS } = this.cx;
        const { SERVER, PROXY } = this.config;
        const instanceController = super.control();
        // ---------------
        if (!FLAGS['test-only'] && !FLAGS['https-only'] && SERVER.port) {
            const httpServer = Http.createServer((request, response) => this.handleNodeHttpRequest(request, response));
            httpServer.listen(SERVER.port);
            this.#servers.set('http', {
                instance: httpServer,
                hostnames: SERVER.hostnames,
                port: SERVER.port,
            });
            // Handle WebSocket connections
            httpServer.on('upgrade', (request, socket, head) => {
                this.handleNodeWsRequest(wss, request, socket, head);
            });
        }
        // ---------------
        if (!FLAGS['test-only'] && !FLAGS['http-only'] && SERVER.https.port) {
            const httpsServer = Https.createServer((request, response) => this.handleNodeHttpRequest(request, response));
            httpsServer.listen(SERVER.https.port);
            const addSSLContext = (SERVER) => {
                if (!Fs.existsSync(SERVER.https.keyfile)) return;
                const cert = {
                    key: Fs.readFileSync(SERVER.https.keyfile),
                    cert: Fs.readFileSync(SERVER.https.certfile),
                };
                SERVER.https.hostnames.forEach((hostname) => {
                    httpsServer.addContext(hostname, cert);
                });
            }
            this.#servers.set('https', {
                instance: httpsServer,
                hostnames: SERVER.https.hostnames,
                port: SERVER.https.port,
            });
            // -------
            addSSLContext(SERVER);
            for (const proxy of PROXY.entries) {
                if (proxy.SERVER) {
                    addSSLContext(proxy.SERVER);
                }
            }
            // Handle WebSocket connections
            httpsServer.on('upgrade', (request, socket, head) => {
                this.handleNodeWsRequest(wss, request, socket, head);
            });
        }
        // ---------------
        const wss = new WebSocket.Server({ noServer: true });
        // -----------------
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.log('Unhandled Rejection', reason, promise);
        });
        return instanceController;
    }

    getRequestProto(nodeRequest) {
        return nodeRequest.connection.encrypted ? 'https' : (nodeRequest.headers['x-forwarded-proto'] || 'http');
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

    async handleNodeWsRequest(wss, nodeRequest, socket, head) {
        const { SERVER, PROXY } = this.config;
        const proto = this.getRequestProto(nodeRequest).replace('http', 'ws');
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest, false);
        const scopeObj = {};
        scopeObj.url = new URL(fullUrl);
        // -----------------
        // Level 1 validation
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.hostnames), []);
        for (const proxy of PROXY.entries) {
            if (proxy.hostnames.includes(scopeObj.url.hostname) || (proxy.hostnames.includes('*') && !hosts.includes('*'))) {
                scopeObj.error = `Web sockets not supported over Webflo reverse proxies`;
                break;
            }
        }
        // -----------------
        // Level 2 validation
        if (!scopeObj.error) {
            if (!hosts.includes(scopeObj.url.hostname) && !hosts.includes('*')) {
                scopeObj.error = 'Unrecognized host';
            } else if (scopeObj.url.protocol === 'ws:' && SERVER.https.port && SERVER.https.force) {
                scopeObj.error = `Only secure connections allowed (wss:)`;
            } else if (scopeObj.url.hostname.startsWith('www.') && SERVER.force_www === 'remove') {
                scopeObj.error = `Connections not allowed over the www subdomain`;
            } else if (!scopeObj.url.hostname.startsWith('www.') && SERVER.force_www === 'add') {
                scopeObj.error = `Connections only allowed over the www subdomain`;
            }
        }
        // -----------------
        // Level 3 validation
        // and actual processing
        if (!scopeObj.error && scopeObj.url.searchParams.get('rel') === 'hmr') {
            wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                wss.emit('connection', ws, nodeRequest);
                this.#hmrRegistry.clients.add(ws);
            });
        }
        if (!scopeObj.error && scopeObj.url.searchParams.get('rel') === 'background-messaging') {
            scopeObj.request = this.createRequest(scopeObj.url.href, requestInit);
            if (!(scopeObj.tenantID = this.#tenants.identifyIncoming(scopeObj.request))
                || !(scopeObj.tenant = this.#tenants.getTenant(scopeObj.tenantID))) {
                scopeObj.error = `Lost or invalid tenantID`;
            } else if (!(scopeObj.clientMessagePort = scopeObj.tenant.getPort(scopeObj.url.pathname.split('/').pop()))) {
                scopeObj.error = `Lost or invalid portID`;
            } else {
                wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                    wss.emit('connection', ws, nodeRequest);
                    const wsw = new MessagingOverSocket(null, ws, { honourDoneMutationFlags: true });
                    scopeObj.clientMessagePort.addPort(wsw);
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
        const { SERVER, PROXY, REDIRECTS } = this.config;
        const proto = this.getRequestProto(nodeRequest);
        const [fullUrl, requestInit] = this.parseNodeRequest(proto, nodeRequest);
        const scopeObj = {};
        scopeObj.url = new URL(fullUrl);
        // -----------------
        // Level 1 handling
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.hostnames), []);
        for (const proxy of PROXY.entries) {
            if (proxy.hostnames.includes(scopeObj.url.hostname) || (proxy.hostnames.includes('*') && !hosts.includes('*'))) {
                scopeObj.response = await this.proxyFetch(proxy, scopeObj.url, scopeObj.init);
                break;
            }
        }
        // -----------------
        // Level 2 handling
        if (!scopeObj.response) {
            if (!hosts.includes(scopeObj.url.hostname) && !hosts.includes('*')) {
                scopeObj.exit = { status: 500, statusText: 'Internal Server Error', };
                scopeObj.exitMessage = 'Unrecognized host';
            } else if (scopeObj.url.protocol === 'http:' && SERVER.https.port && SERVER.https.force) {
                scopeObj.exit = {
                    status: 302,
                    statusText: 'Found',
                    headers: { Location: (scopeObj.url.protocol = 'https:', scopeObj.url.href) }
                };
            } else if (scopeObj.url.hostname.startsWith('www.') && SERVER.force_www === 'remove') {
                scopeObj.exit = {
                    status: 302,
                    statusText: 'Found',
                    headers: { Location: (scopeObj.url.hostname = scopeObj.url.hostname.substr(4), scopeObj.url.href) }
                };
            } else if (!scopeObj.url.hostname.startsWith('www.') && SERVER.force_www === 'add') {
                scopeObj.exit = {
                    status: 302,
                    statusText: 'Found',
                    headers: { Location: (scopeObj.url.hostname = `www.${scopeObj.url.hostname}`, scopeObj.url.href) }
                };
            } else if (REDIRECTS) {
                scopeObj.exit = REDIRECTS.entries.reduce((_rdr, entry) => {
                    return _rdr || ((_rdr = (new URLPattern(entry.from, scopeObj.url.origin)).exec(scopeObj.url.href)) && {
                        status: entry.code || 302,
                        statusText: entry.code === 301 ? 'Moved Permanently' : 'Found',
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
            const { logger: LOGGER } = this.cx;
            if (LOGGER) {
                const log = this.generateLog({ url: fullUrl, method: nodeRequest.method }, scopeObj.response);
                LOGGER.log(log);
            }
        }
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
        const $sparoots = this.#routes.$sparoots;
        const xRedirectPolicy = httpEvent.request.headers.get('X-Redirect-Policy');
        const xRedirectCode = httpEvent.request.headers.get('X-Redirect-Code') || 300;
        const destinationUrl = new URL(response.headers.get('Location'), httpEvent.url.origin);
        const isSameOriginRedirect = destinationUrl.origin === httpEvent.url.origin;
        let isSameSpaRedirect = false;
        if (isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-spa' && $sparoots.length) {
            // Longest-first sorting
            const sparoots = $sparoots.sort((a, b) => a.length > b.length ? -1 : 1);
            const matchRoot = path => sparoots.reduce((prev, root) => prev || (`${path}/`.startsWith(`${root}/`) && root), null);
            isSameSpaRedirect = matchRoot(destinationUrl.pathname) === matchRoot(httpEvent.url.pathname);
        }
        if (xRedirectPolicy === 'manual' || (!isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-origin') || (!isSameSpaRedirect && xRedirectPolicy === 'manual-when-cross-spa')) {
            response.headers.set('X-Redirect-Code', response.status);
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Cache-Control', 'no-store');
            const responseMeta = _wq(response, 'meta');
            responseMeta.set('status', xRedirectCode);
        }
    }

    createRequest(href, init = {}, autoHeaders = []) {
        const request = super.createRequest(href, init);
        this.writeAutoHeaders(request.headers, autoHeaders);
        return request;
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

    async proxyFetch(proxy, url, init) {
        const scopeObj = {};
        scopeObj.url = new URL(url);
        scopeObj.url.port = proxy.port;
        if (proxy.proto) {
            scopeObj.url.protocol = proxy.proto;
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
            scopeObj.response = new Response(`Reverse Proxy Error: ${e.message}`, { status: 500, statusText: 'Internal Server Error' });
            console.error(e);
        }
        return scopeObj.response;
    }

    async localFetch(httpEvent) {
        const { flags: FLAGS } = this.cx;
        const { DEV_LAYOUT, LAYOUT } = this.config;
        const scopeObj = {};
        if (FLAGS['dev'] && httpEvent.url.pathname === '/@dev') {
            const filename = httpEvent.url.searchParams.get('src').split('?')[0];
            if (filename.endsWith('.js')) {
                scopeObj.filename = Path.join(DEV_LAYOUT.PUBLIC_DIR, filename);
            } else {
                scopeObj.filename = Path.join(LAYOUT.PUBLIC_DIR, filename);
            }
        } else {
            scopeObj.filename = Path.join(LAYOUT.PUBLIC_DIR, httpEvent.url.pathname.split('?')[0]);
        }
        scopeObj.ext = Path.parse(scopeObj.filename).ext;
        const finalizeResponse = (response) => {
            const responseMeta = _wq(response, 'meta');
            responseMeta.set('filename', scopeObj.filename);
            responseMeta.set('static', true);
            responseMeta.set('index', scopeObj.index);
            return response;
        };
        // Pre-encoding support?
        if (scopeObj.preEncodingSupportLevel !== 0) {
            scopeObj.acceptEncs = [];
            scopeObj.supportedEncs = { gzip: '.gz', br: '.br' };
            if ((scopeObj.acceptEncs = (httpEvent.request.headers.get('Accept-Encoding') || '').split(',').map((e) => e.trim())).length
                && (scopeObj.enc = scopeObj.acceptEncs.reduce((prev, _enc) => prev || (scopeObj.supportedEncs[_enc] && Fs.existsSync(scopeObj.filename + scopeObj.supportedEncs[_enc]) && _enc), null))) {
                // Route to a pre-compressed version of the file
                scopeObj.filename = scopeObj.filename + scopeObj.supportedEncs[scopeObj.enc];
                scopeObj.stats = null;
            } else if (scopeObj.acceptEncs.length) {
                // TODO: Do dynamic encoding
            }
        }
        // if is a directory, search for index file matching the extention
        if (!scopeObj.ext && scopeObj.autoIndexFileSupport !== false && Fs.existsSync(scopeObj.filename) && (scopeObj.stats = Fs.lstatSync(scopeObj.filename)).isDirectory()) {
            scopeObj.ext = '.html';
            scopeObj.index = `index${scopeObj.ext}`;
            scopeObj.filename = Path.join(scopeObj.filename, scopeObj.index);
            scopeObj.stats = null;
        }
        // ------ If we get here, scopeObj.filename has been finalized ------
        // Do file stats
        if (!scopeObj.stats) {
            try { scopeObj.stats = Fs.statSync(scopeObj.filename); } catch (e) {
                if (e.code === 'ENOENT') return finalizeResponse(new Response(null, { status: 404, statusText: 'Not Found' }));
                throw e; // Re-throw other errors
            }
        }
        // ETag support
        scopeObj.stats.etag = `W/"${scopeObj.stats.size}-${scopeObj.stats.mtimeMs}"`;
        const ifNoneMatch = httpEvent.request.headers.get('If-None-Match');
        if (scopeObj.stats.etag && ifNoneMatch === scopeObj.stats.etag) {
            const response = new Response(null, { status: 304, statusText: 'Not Modified' });
            response.headers.set('ETag', scopeObj.stats.etag);
            response.headers.set('Last-Modified', scopeObj.stats.mtime.toUTCString());
            response.headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
            return finalizeResponse(response);
        }
        scopeObj.stats.mime = scopeObj.ext && Mime.lookup(scopeObj.ext)?.replace('application/javascript', 'text/javascript') || 'application/octet-stream';
        // Range support
        const readStream = (params = {}) => Fs.createReadStream(scopeObj.filename, { ...params });
        scopeObj.response = this.createStreamingResponse(httpEvent, readStream, scopeObj.stats);
        if (scopeObj.response.status === 416) return finalizeResponse(scopeObj.response);
        // ------ If we get here, it means we're good ------
        if (scopeObj.enc) {
            scopeObj.response.headers.set('Content-Encoding', scopeObj.enc);
        }
        // 1. Strong cache validators
        scopeObj.response.headers.set('ETag', scopeObj.stats.etag);
        scopeObj.response.headers.set('Last-Modified', scopeObj.stats.mtime.toUTCString());
        // 2. Content presentation and policy
        scopeObj.response.headers.set('Content-Disposition', `inline; filename="${Path.basename(scopeObj.filename)}"`);
        scopeObj.response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
        // 3. Cache-Control
        scopeObj.response.headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
        scopeObj.response.headers.set('Vary', 'Accept-Encoding'); // The header that talks to our support for "Accept-Encoding"
        // 4. Security headers
        scopeObj.response.headers.set('X-Content-Type-Options', 'nosniff');
        scopeObj.response.headers.set('Access-Control-Allow-Origin', '*');
        scopeObj.response.headers.set('X-Frame-Options', 'SAMEORIGIN');
        // 5. Partial content support
        scopeObj.response.headers.set('Accept-Ranges', 'bytes');
        return finalizeResponse(scopeObj.response);
    }

    async navigate(url, init = {}, detail = {}) {
        const { HEADERS } = this.config;
        const { flags: FLAGS } = this.cx;
        const scopeObj = { url, init, detail };
        if (typeof scopeObj.url === 'string') {
            scopeObj.url = new URL(scopeObj.url, 'http://localhost');
        }
        // Request processing
        scopeObj.autoHeaders = HEADERS.entries.filter((entry) => (new URLPattern(entry.url, url.origin)).exec(url.href)) || [];
        scopeObj.request = this.createRequest(scopeObj.url.href, scopeObj.init, scopeObj.autoHeaders.filter((header) => header.type === 'request'));
        scopeObj.cookies = this.createHttpCookies({
            request: scopeObj.request
        });
        scopeObj.tenantID = this.#tenants.identifyIncoming(scopeObj.request, true);
        scopeObj.tenant = this.#tenants.getTenant(scopeObj.tenantID, true);
        scopeObj.clientMessagePort = scopeObj.tenant.createPort({ url: scopeObj.request.url, honourDoneMutationFlags: true });
        scopeObj.sessionTTL = this.env('SESSION_TTL') || 2592000/*30days*/;
        scopeObj.session = this.createHttpSession({
            store: this.#sdk.storage?.(`${scopeObj.url.host}/session:${scopeObj.tenantID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            sessionID: scopeObj.tenantID,
            ttl: scopeObj.sessionTTL
        });
        scopeObj.user = this.createHttpUser({
            store: this.#sdk.storage?.(`${scopeObj.url.host}/user:${scopeObj.tenantID}`, scopeObj.sessionTTL),
            client: scopeObj.clientMessagePort,
            request: scopeObj.request,
            session: scopeObj.session,
        });
        scopeObj.httpEvent = this.createHttpEvent({
            request: scopeObj.request,
            cookies: scopeObj.cookies,
            session: scopeObj.session,
            user: scopeObj.user,
            client: scopeObj.clientMessagePort,
            detail: scopeObj.detail,
            sdk: this.#sdk,
        });
        // Dispatch for response
        scopeObj.response = await this.dispatchNavigationEvent({
            httpEvent: scopeObj.httpEvent,
            crossLayerFetch: (event) => this.localFetch(event),
            backgroundMessagingPort: `ws:${scopeObj.httpEvent.client.portID}?rel=background-messaging`
        });
        if (FLAGS['dev']) {
            scopeObj.response.headers.set('X-Webflo-Dev-Mode', 'true'); // Must come before satisfyRequestFormat() sp as to be rendered
        }
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
        const responseMeta = _wq(response, 'meta');
        if (requestAccept && asHTML >= asIs && !responseMeta.get('static')) {
            response = await this.render(httpEvent, response);
        } else if (requestAccept && response.headers.get('Content-Type') && !asIs) {
            return new Response(response.body, { status: 406, statusText: 'Not Acceptable', headers: response.headers });
        }
        // ------- With "exception" responses out of the way,
        // let's set the header that talks to our support for "Accept"
        if (!responseMeta.get('static')) {
            response.headers.append('Vary', 'Accept');
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
        const { LAYOUT } = this.config;
        const scopeObj = {};
        scopeObj.router = new this.constructor.Router(this, httpEvent.url.pathname);
        scopeObj.rendering = await scopeObj.router.route('render', httpEvent, async (httpEvent) => {
            let renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(LAYOUT.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html'))
                && (this.#renderFileCache.get(renderFile) === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.#renderFileCache.set(renderFile, false);
                pathnameSplit.pop();
            }
            const dirPublic = Url.pathToFileURL(Path.resolve(Path.join(LAYOUT.PUBLIC_DIR)));
            const instanceParams = /*QueryString.stringify*/({
                //file: renderFile,
                url: dirPublic.href,// httpEvent.url.href,
            });
            const { window, document } = createWindow(renderFile, instanceParams);
            //const { window, document } = await import('@webqit/oohtml-ssr/src/instance.js?' + instanceParams);
            await new Promise((res) => {
                if (document.readyState === 'complete') return res(1);
                document.addEventListener('load', res);
            });
            const data = await response.parse();
            if (window.webqit?.oohtml?.config) {
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
                } = window.webqit.oohtml.config;
                if (modulesContextAttrs) {
                    const newRoute = '/' + `app/${httpEvent.url.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
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
            for (const name of ['X-Background-Messaging-Port', 'X-Live-Response-Message-ID', 'X-Webflo-Dev-Mode']) {
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
            statusText: response.statusText,
        });
        scopeObj.response.headers.set('Content-Type', 'text/html');
        scopeObj.response.headers.set('Content-Length', (new Blob([scopeObj.rendering])).size);
        return scopeObj.response;
    }

    generateLog(request, response, isproxy = false) {
        const { logger: LOGGER } = this.cx;
        const log = [];
        // ---------------
        const style = LOGGER.style || { keyword: (str) => str, comment: (str) => str, url: (str) => str, val: (str) => str, err: (str) => str, };
        const errorCode = response.status >= 400 && response.status < 500 ? response.status : 0;
        const xRedirectCode = response.headers.get('X-Redirect-Code');
        const isRedirect = (xRedirectCode || response.status + '').startsWith('3') && (xRedirectCode || response.status) !== 304;
        const statusCode = xRedirectCode && `${xRedirectCode} (${response.status})` || response.status;
        const responseMeta = _wq(response, 'meta');
        // ---------------
        log.push(`[${style.comment((new Date).toUTCString())}]`);
        log.push(style.keyword(request.method));
        if (isproxy) log.push(style.keyword('>>'));
        log.push(style.url(request.url));
        if (responseMeta.has('hint')) log.push(`(${style.comment(responseMeta.get('hint'))})`);
        const contentInfo = [response.headers.get('Content-Type'), response.headers.get('Content-Length') && this.formatBytes(response.headers.get('Content-Length'))].filter((x) => x);
        if (contentInfo.length) log.push(`(${style.comment(contentInfo.join('; '))})`);
        if (response.headers.get('Content-Encoding')) log.push(`(${style.comment(response.headers.get('Content-Encoding'))})`);
        if (errorCode) log.push(style.err(`${errorCode} ${response.statusText}`));
        else log.push(style.val(`${statusCode} ${response.statusText}`));
        if (isRedirect) log.push(`- ${style.url(response.headers.get('Location'))}`);
        return log.join(' ');
    }

    formatBytes(bytes, decimals = 5, locale = 'en', withSpace = true) {
        if (bytes + '' === '0') return `0${withSpace ? ' ' : ''}B`;
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const rawValue = bytes / Math.pow(k, i);
        const formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals,
        });
        return `${formatter.format(rawValue)}${withSpace ? ' ' : ''}${sizes[i]}`;
    }
}