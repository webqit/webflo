import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import { WebSocketServer } from 'ws';
import Mime from 'mime-types';
import crypto from 'crypto';
import 'dotenv/config';
import $glob from 'fast-glob';
import EsBuild from 'esbuild';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { _from as _arrFrom, _any } from '@webqit/util/arr/index.js';
import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import { _each } from '@webqit/util/obj/index.js';
import { WebfloHMR, openBrowser } from './webflo-devmode.js';
import { Clients } from './messaging/Clients.js';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { WQSockPort } from '../webflo-messaging/WQSockPort.js';
import { ServerSideCookies } from './ServerSideCookies.js';
import { ServerSideSession } from './ServerSideSession.js';
import { response as responseShim, headers as headersShim } from '../webflo-fetch/index.js';
import { UseLiveTransform } from '../../build-pi/esbuild-plugin-uselive-transform.js';
import { createWindow } from '@webqit/oohtml-ssr';
import { _wq } from '../../util.js';
import '../webflo-fetch/index.js';
import '../webflo-url/index.js';

export class WebfloServer extends WebfloRuntime {

    static get HttpCookies() { return ServerSideCookies; }

    static get HttpSession() { return ServerSideSession; }

    static create(bootstrap) {
        return new this(bootstrap);
    }

    #servers = new Map;
    #clients = new Clients;
    #hmr;

    #renderFileCache = new Map;

    env(key) {
        const { ENV } = this.config;
        return key in ENV.mappings
            ? process.env[ENV.mappings[key]]
            : process.env[key];
    }

    async initialize() {
        const { appMeta: APP_META, flags: FLAGS, logger: LOGGER, } = this.cx;

        // ----------
        // Initialize routes
        if (FLAGS['dev']) {
            await this.enterDevMode();
        } else {
            await this.buildRoutes({ server: true });
        }

        // ----------
        // Call default-init
        const instanceController = await super.initialize();

        // ----------
        // Start serving
        this.control();

        // ----------
        // Show proxies
        const { PROXY } = this.config;
        if (PROXY.entries.length) {
            // Show active proxies
            LOGGER.info(`> Reverse proxies active.`);
            for (const proxy of PROXY.entries) {
                let desc = `> ${proxy.hostnames.join('|')} >>> ${proxy.port || proxy.path}`;
                // Start a proxy recursively?
                if (proxy.path && FLAGS['recursive']) {
                    desc += ` ✅`;
                    const flags = Object.entries({ ...FLAGS, port: proxy.port }).map(([k, v]) => v === true ? `--${k}` : `--${k}=${v}`);
                    spawn('npx', ['webflo', 'start', ...flags], {
                        cwd: proxy.path,  // target directory
                        stdio: 'inherit', // inherit stdio so output streams to parent terminal
                        shell: true       // for Windows compatibility
                    });
                }
                LOGGER.info(desc);
            }
        }

        // ----------
        // Show server details
        if (this.#servers.size) {
            LOGGER.info(`> Server running! (${APP_META.title || ''}) ✅`);
            for (let [proto, def] of this.#servers) {
                LOGGER.info(`> ${proto.toUpperCase()} / ${def.hostnames.concat('').join(`:${def.port} / `)}`);
            }
        } else {
            LOGGER.info(`> No servers running!`);
        }

        return instanceController;
    }

    async buildRoutes({ client = false, worker = false, server = false, ...options } = {}) {
        const routeDirs = [...new Set([this.config.LAYOUT.CLIENT_DIR, this.config.LAYOUT.WORKER_DIR, this.config.LAYOUT.SERVER_DIR])];
        const entryPoints = await $glob(routeDirs.map((d) => `${d}/**/handler{${client ? ',.client' : ''}${worker ? ',.worker' : ''}${server ? ',.server' : ''}}.js`), { absolute: true })
            .then((files) => files.map((file) => file.replace(/\\/g, '/')));
        const initFiles = await $glob(`${process.cwd()}/init.server.js`);
        const bundlingConfig = {
            entryPoints: entryPoints.concat(initFiles),
            outdir: this.config.RUNTIME_DIR,
            outbase: process.cwd(),
            format: 'esm',
            platform: server ? 'node' : 'browser',
            bundle: server ? false : true,
            minify: server ? false : true,
            sourcemap: false,
            treeShaking: true,
            plugins: [UseLiveTransform()],
            ...options,
        };
        return await EsBuild.build(bundlingConfig);
    }

    async enterDevMode() {
        const { appMeta, flags: FLAGS } = this.cx;
        this.#hmr = WebfloHMR.manage(this, {
            appMeta,
            buildScripts: {
                ['build:html']: FLAGS['build:html'] ?? true,
                ['build:css']: FLAGS['build:css'] ?? true,
                ['build:js']: FLAGS['build:js'] ?? true,
            },
            buildSensitivity: parseInt(FLAGS['build-sensitivity'] || 0),
        });
        await this.#hmr.buildRoutes(true);
        await this.#hmr.bundleAssetsIfPending(true);
        if (FLAGS['open']) {
            for (let [proto, def] of this.#servers) {
                const url = `${proto}://${def.hostnames.find((h) => h !== '*') || 'localhost'}:${def.port}`;
                await openBrowser(url);
            }
        }
    }

    async initCreateStorage() {
        if (this.bootstrap.init.createStorage
            || !this.bootstrap.init.redis) {
            return super.initCreateStorage();
        }
        const redis = this.bootstrap.init.redis;
        this.bootstrap.init.createStorage = (namespace, ttl = null) => ({
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
    }

    control() {
        const { flags: FLAGS } = this.cx;
        const { SERVER, PROXY } = this.config;
        const instanceController = super.control();

        if (!FLAGS['test-only'] && !FLAGS['https-only'] && SERVER.port) {
            const httpServer = Http.createServer((request, response) => this.handleNodeHttpRequest(request, response));
            httpServer.listen(FLAGS['port'] || SERVER.port);
            this.#servers.set('http', {
                instance: httpServer,
                hostnames: SERVER.hostnames,
                port: FLAGS['port'] || SERVER.port,
            });
            // Handle WebSocket connections
            httpServer.on('upgrade', (request, socket, head) => {
                this.handleNodeWsRequest(wss, request, socket, head);
            });
        }

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

        const wss = new WebSocketServer({ noServer: true });

        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.log('Unhandled Rejection', reason, promise);
        });

        return instanceController;
    }

    identifyIncoming(request, autoGenerateID = false) {
        const secret = this.env('SESSION_KEY');
        let clientID = headersShim.get.value.call(request.headers, 'Cookie', true).find((c) => c.name === '__sessid')?.value;
        if (clientID?.includes('.')) {
            if (secret) {
                const [rand, signature] = clientID.split('.');
                const expectedSignature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                if (signature !== expectedSignature) {
                    clientID = null;
                }
            } else {
                clientID = null;
            }
        }
        if (!clientID && autoGenerateID) {
            if (secret) {
                const rand = `${(0 | Math.random() * 9e6).toString(36)}`;
                const signature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                clientID = `${rand}.${signature}`
            } else {
                clientID = crypto.randomUUID();
            }
        }
        return clientID;
    }

    async preResolveIncoming({ type, nodeRequest, proxy, reject, handle }) {
        const { SERVER, PROXY, REDIRECTS } = this.config;
        // Derive proto
        const protoDef = type === 'ws' ? { nonSecure: 'ws', secure: 'wss' } : { nonSecure: 'http', secure: 'https' };
        const proto = nodeRequest.connection.encrypted ? protoDef.secure : (nodeRequest.headers['x-forwarded-proto'] || protoDef.nonSecure);
        // Resolve malformed URL: detected when using manual proxy setting in a browser
        let requestUrl = nodeRequest.url;
        if (requestUrl.startsWith(`${proto}://${nodeRequest.headers.host}`)) {
            requestUrl = requestUrl.split(nodeRequest.headers.host)[1];
        }
        const fullUrl = proto + '://' + nodeRequest.headers.host + requestUrl;
        const url = new URL(fullUrl);
        // Begin resolution...
        const hosts = [...this.#servers.values()].reduce((_hosts, server) => _hosts.concat(server.hostnames), []);
        // Level 1 resolution
        for (const $proxy of PROXY.entries) {
            if ($proxy.hostnames.includes(url.hostname) || ($proxy.hostnames.includes('*') && !hosts.includes('*'))) {
                url.port = $proxy.port; // The port forwarding
                if ($proxy.proto) { // Force proto?
                    url.protocol = type === 'ws' ? $proxy.proto.replace('http', 'ws') : $proxy.proto;
                }
                return await proxy(url);
            }
        }
        // Level 2 resolution
        if (!hosts.includes(url.hostname) && !hosts.includes('*')) {
            return reject({
                status: 500,
                statusText: 'Unrecognized host',
            });
        }
        if (url.protocol === `${protoDef.nonSecure}:` && SERVER.https.port && SERVER.https.force) {
            return reject({
                status: 302,
                statusText: 'Found',
                headers: { Location: (url.protocol = `${protoDef.secure}:`, url.href) }
            });
        }
        if (url.hostname.startsWith('www.') && SERVER.force_www === 'remove') {
            return reject({
                status: 302,
                statusText: 'Found',
                headers: { Location: (url.hostname = url.hostname.substr(4), url.href) }
            });
        }
        if (!url.hostname.startsWith('www.') && SERVER.force_www === 'add') {
            return reject({
                status: 302,
                statusText: 'Found',
                headers: { Location: (url.hostname = `www.${url.hostname}`, url.href) }
            });
        }
        if (REDIRECTS) {
            const rejection = REDIRECTS.entries.reduce((_rdr, entry) => {
                return _rdr || ((_rdr = (new URLPattern(entry.from, url.origin)).exec(url.href)) && {
                    status: entry.code || 302,
                    statusText: entry.code === 301 ? 'Moved Permanently' : 'Found',
                    headers: { Location: _rdr.render(entry.to) }
                });
            }, null);
            if (rejection) {
                return reject(rejection);
            }
        }
        return handle(url);
    }

    async handleNodeWsRequest(wss, nodeRequest, socket, head) {
        const reject = (rejection) => {
            const status = rejection.status || 400;
            const statusText = rejection.statusText || 'Bad Request';
            const headers = rejection.headers || {};
            const body = rejection.body || `${status} ${statusText}`;
            // Write status line and headers
            socket.write(
                `HTTP/1.1 ${status} ${statusText}\r\n` +
                Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join('') +
                `Content-Type: text/plain\r\n` +
                `Connection: close\r\n` +
                `\r\n` +
                body + `\r\n`
            );
            socket.destroy();
        };
        const proxy = async (destinationURL) => {
            const isSecure = destinationURL.protocol === 'wss:';
            const port = destinationURL.port || (isSecure ? 443 : 80);
            const host = destinationURL.hostname;
            // Connect
            const connect = isSecure
                ? (await import('node:tls')).connect
                : (await import('node:net')).connect;
            // Create a TCP or TLS socket to the target WS server and pipe streams
            const proxySocket = connect({ host, port, servername: isSecure ? host : undefined/*required for TLS SNI*/ }, () => {
                // Send raw upgrade HTTP request to the target
                proxySocket.write(`${nodeRequest.method} ${nodeRequest.url} HTTP/${nodeRequest.httpVersion}\r\n`);
                for (const [key, value] of Object.entries(nodeRequest.headers)) {
                    proxySocket.write(`${key}: ${value}\r\n`);
                }
                proxySocket.write('\r\n');
                if (head && head.length) {
                    proxySocket.write(head);
                }
                // Pipe both sockets together
                socket.pipe(proxySocket).pipe(socket);
            });
            // Handle errors
            proxySocket.on('error', err => {
                console.error('Proxy socket error:', err);
                socket.destroy();
            });
            socket.on('error', () => {
                proxySocket.destroy();
            });
        };
        const handle = (requestURL) => {
            if (requestURL.searchParams.get('rel') === 'hmr') {
                wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                    wss.emit('connection', ws, nodeRequest);
                    this.#hmr.clients.add(ws);
                });
            }
            if (requestURL.searchParams.get('rel') === 'background-messaging') {
                const request = new Request(requestURL.href, { headers: nodeRequest.headers });
                const clientID = this.identifyIncoming(request);
                const client = clientID && this.#clients.getClient(clientID);
                if (!client) {
                    return reject({ body: `Lost or invalid clientID` });
                }
                const clientRequestRealtime = client?.getRequestRealtime(requestURL.pathname.split('/').pop());
                if (!clientRequestRealtime) {
                    return reject({ body: `Lost or invalid portID` });
                }
                wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                    wss.emit('connection', ws, nodeRequest);
                    const wsw = new WQSockPort(ws);
                    clientRequestRealtime.addPort(wsw);
                });
            }
        };
        return await this.preResolveIncoming({ type: 'ws', nodeRequest, proxy, reject, handle });
    }

    async handleNodeHttpRequest(nodeRequest, nodeResponse) {
        // Pipe back response and log
        const respondWith = (response, requestURL) => {
            for (const [name, value] of response.headers) {
                const existing = nodeResponse.getHeader(name);
                if (existing) nodeResponse.setHeader(name, [].concat(existing).concat(value));
                else nodeResponse.setHeader(name, value);
            }
            nodeResponse.statusCode = responseShim.prototype.status.get.call(response);
            nodeResponse.statusMessage = response.statusText;
            if (response.body instanceof Readable) {
                response.body.pipe(nodeResponse);
            } else if (response.body instanceof ReadableStream) {
                Readable.fromWeb(response.body).pipe(nodeResponse);
            } else if (response.body) {
                nodeResponse.end(response.body);
            } else {
                nodeResponse.end();
            }
            // Logging
            const { logger: LOGGER } = this.cx;
            if (LOGGER && requestURL) {
                const log = this.generateLog({ url: requestURL.href, method: nodeRequest.method }, response);
                LOGGER.log(log);
            }
        };
        // Reject with error status
        const reject = async (rejection) => {
            respondWith(new Response(null, rejection));
        };
        // Proxy request to a remote/local host
        const proxy = async (destinationURL) => {
            const requestInit = this.parseNodeRequest(nodeRequest);
            requestInit.headers.host = destinationURL.host;
            delete requestInit.headers.connection;
            const response = await fetch(destinationURL, requestInit);
            respondWith(response, destinationURL);
        };
        // Handle
        const handle = async (requestURL) => {
            const requestInit = this.parseNodeRequest(nodeRequest);
            const response = await this.navigate(requestURL, requestInit, {
                request: nodeRequest,
                response: nodeResponse,
                ipAddress: nodeRequest.headers['x-forwarded-for']?.split(',')[0] || nodeRequest.socket.remoteAddress
            });
            respondWith(response, requestURL);
        };
        return await this.preResolveIncoming({ typr: 'http', nodeRequest, reject, proxy, handle });
    }

    parseNodeRequest(nodeRequest, withBody = true) {
        const requestInit = { method: nodeRequest.method, headers: nodeRequest.headers };
        if (withBody && !['GET', 'HEAD'].includes(nodeRequest.method)) {
            nodeRequest[Symbol.toStringTag] = 'ReadableStream'; // Not necessary, but fun
            requestInit.body = nodeRequest;
            requestInit.duplex = 'half'; // See https://github.com/nodejs/node/issues/46221
        }
        return requestInit;
    }

    createRequest(href, init = {}, autoHeaders = []) {
        const request = super.createRequest(href, init);
        this.writeAutoHeaders(request.headers, autoHeaders);
        return request;
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
        const $sparoots = this.bootstrap.$sparoots;
        const xRedirectPolicy = httpEvent.request.headers.get('X-Redirect-Policy');
        const xRedirectCode = httpEvent.request.headers.get('X-Redirect-Code') || 300;
        const destinationURL = new URL(response.headers.get('Location'), httpEvent.url.origin);
        const isSameOriginRedirect = destinationURL.origin === httpEvent.url.origin;
        let isSameSpaRedirect = true;
        if (isSameOriginRedirect && xRedirectPolicy === 'manual-when-cross-spa' && $sparoots.length) {
            // Longest-first sorting
            const sparoots = $sparoots.sort((a, b) => a.length > b.length ? -1 : 1);
            const matchRoot = path => sparoots.reduce((prev, root) => prev || (`${path}/`.startsWith(`${root}/`) && root), null);
            isSameSpaRedirect = matchRoot(destinationURL.pathname) === matchRoot(httpEvent.url.pathname);
        }
        if (xRedirectPolicy === 'manual' || (!isSameOriginRedirect && (xRedirectPolicy === 'manual-when-cross-origin' || xRedirectPolicy === 'manual-when-cross-spa')) || (!isSameSpaRedirect && xRedirectPolicy === 'manual-when-cross-spa')) {
            response.headers.set('X-Redirect-Code', responseShim.prototype.status.get.call(response));
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Cache-Control', 'no-store');
            const responseMeta = _wq(response, 'meta');
            responseMeta.set('status', xRedirectCode);
        }
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
        const { flags: FLAGS } = this.cx;
        const { RUNTIME_LAYOUT, LAYOUT } = this.config;
        const scopeObj = {};
        if (FLAGS['dev']) {
            if (httpEvent.url.pathname === '/@hmr') {
                const filename = httpEvent.url.searchParams.get('src')?.split('?')[0] || '';
                if (filename.endsWith('.js')) {
                    // This is purely a route handler source request from HMR
                    scopeObj.filename = Path.join(RUNTIME_LAYOUT.PUBLIC_DIR, filename);
                } else {
                    // This is a static asset (HTML) request from HMR
                    scopeObj.filename = Path.join(LAYOUT.PUBLIC_DIR, filename);
                }
            } else {
                if (this.#hmr.options.buildSensitivity === 1) {
                    // This is a static asset request in dev mode but NOT from HMR
                    await this.#hmr.bundleAssetsIfPending();
                }
                scopeObj.filename = Path.join(LAYOUT.PUBLIC_DIR, httpEvent.url.pathname.split('?')[0]);
            }
        } else {
            scopeObj.filename = Path.join(LAYOUT.PUBLIC_DIR, httpEvent.url.pathname.split('?')[0]);
        }
        scopeObj.ext = Path.parse(scopeObj.filename).ext;
        const finalizeResponse = (response) => {
            // Qualify Service-Worker responses
            if (httpEvent.request.headers.get('Service-Worker') === 'script') {
                response.headers.set('Service-Worker-Allowed', this.config.WORKER.scope || '/');
            }
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
        const statusCode = responseShim.prototype.status.get.call(scopeObj.response);
        if (statusCode === 416) return finalizeResponse(scopeObj.response);
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
        scopeObj.clientID = this.identifyIncoming(scopeObj.request, true);
        scopeObj.client = this.#clients.getClient(scopeObj.clientID, true);
        scopeObj.clientPortID = crypto.randomUUID();
        scopeObj.clientRequestRealtime = scopeObj.client.createRequestRealtime(scopeObj.clientPortID, scopeObj.request.url);
        scopeObj.sessionTTL = this.env('SESSION_TTL') || 2592000/*30days*/;
        scopeObj.thread = this.createHttpThread({
            store: this.createStorage(`${scopeObj.url.host}/thread:${scopeObj.clientID}`, scopeObj.sessionTTL),
            threadID: scopeObj.url.searchParams.get('_thread'),
            realm: 3
        });
        scopeObj.cookies = this.createHttpCookies({
            request: scopeObj.request,
            thread: scopeObj.thread,
            realm: 3
        });
        scopeObj.session = this.createHttpSession({
            store: this.createStorage(`${scopeObj.url.host}/session:${scopeObj.clientID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            thread: scopeObj.thread,
            sessionID: scopeObj.clientID,
            ttl: scopeObj.sessionTTL,
            realm: 3
        });
        scopeObj.user = this.createHttpUser({
            store: this.createStorage(`${scopeObj.url.host}/user:${scopeObj.clientID}`, scopeObj.sessionTTL),
            request: scopeObj.request,
            thread: scopeObj.thread,
            client: scopeObj.clientRequestRealtime,
            realm: 3
        });
        scopeObj.httpEvent = this.createHttpEvent({
            request: scopeObj.request,
            thread: scopeObj.thread,
            client: scopeObj.clientRequestRealtime,
            cookies: scopeObj.cookies,
            session: scopeObj.session,
            user: scopeObj.user,
            detail: scopeObj.detail,
            realm: 3
        });
        // Dispatch for response
        scopeObj.response = await this.dispatchNavigationEvent({
            httpEvent: scopeObj.httpEvent,
            crossLayerFetch: (event) => this.localFetch(event),
            clientPortB: `ws:${scopeObj.httpEvent.client.portID}?rel=background-messaging`
        });
        // Reponse handlers
        if (FLAGS['dev']) {
            scopeObj.response.headers.set('X-Webflo-Dev-Mode', 'true'); // Must come before satisfyRequestFormat() sp as to be rendered
        }
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
        const statusCode = responseShim.prototype.status.get.call(response);
        if (statusCode === 206 || statusCode === 416) {
            // If the response is a partial content, we don't need to do anything else
            return response;
        }
        // Satisfy "Accept" header
        const requestAccept = headersShim.get.value.call(httpEvent.request.headers, 'Accept', true);
        const asHTML = requestAccept?.match('text/html');
        const asIs = requestAccept?.match(response.headers.get('Content-Type'));
        const responseMeta = _wq(response, 'meta');
        if (requestAccept && asHTML > asIs && !responseMeta.get('static')) {
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
        const requestRange = headersShim.get.value.call(httpEvent.request.headers, 'Range', true);
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
            const data = await responseShim.prototype.parse.value.call(response);
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
        const statusCode = responseShim.prototype.status.get.call(response);
        scopeObj.response = new Response(scopeObj.rendering, {
            headers: response.headers,
            status: statusCode,
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
        const statusCode = responseShim.prototype.status.get.call(response);
        const errorCode = statusCode >= 400 && statusCode < 500 ? statusCode : 0;
        const xRedirectCode = response.headers.get('X-Redirect-Code');
        const isRedirect = (xRedirectCode || statusCode + '').startsWith('3') && (xRedirectCode || statusCode) !== 304;
        const _statusCode = xRedirectCode && `${xRedirectCode} (${statusCode})` || statusCode;
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
        else log.push(style.val(`${_statusCode} ${response.statusText}`));
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