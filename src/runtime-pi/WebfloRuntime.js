import { WebfloRouter } from './webflo-routing/WebfloRouter.js';
import { response as responseShim, headers as headersShim } from './webflo-fetch/index.js';
import { LiveResponse } from './webflo-fetch/LiveResponse.js';
import { AppBootstrap } from './AppBootstrap.js';
import { _wq } from '../util.js';

export class WebfloRuntime {

    #instanceController = new AbortController;
    get $instanceController() { return this.#instanceController; }

    static get Router() { return WebfloRouter; }

    static create(bootstrap) { return new this(bootstrap); }

    #bootstrap;

    get bootstrap() { return this.#bootstrap; }
    get cx() { return this.bootstrap.cx; }
    get config() { return this.bootstrap.config; }
    get routes() { return this.bootstrap.routes; }

    constructor(bootstrap) {
        this.#bootstrap = new AppBootstrap(bootstrap);
    }

    env(key) {
        const { ENV } = this.config;
        return key in ENV.mappings
            ? ENV.data?.[ENV.mappings[key]]
            : ENV.data?.[key];
    }

    async initialize() {
        if (this.bootstrap.init.SETUP) {
            await this.bootstrap.init.SETUP(this);
        }
        await this.initCreateStorage();
        return this.#instanceController;
    }

    async initCreateStorage() {
        if (!this.bootstrap.init.createStorage) {
            const inmemSessionRegistry = new Map;
            this.bootstrap.init.createStorage = (namespace) => {
                if (!inmemSessionRegistry.has(namespace)) {
                    inmemSessionRegistry.set(namespace, new Map);
                }
                return inmemSessionRegistry.get(namespace);
            };
        }
        return this.#instanceController;
    }

    async setupCapabilities() {
        return this.#instanceController;
    }

    async hydrate() {
        return this.#instanceController;
    }

    control() {
        return this.#instanceController;
    }

    createStorage(namespace, ttl) {
        return this.bootstrap.init.createStorage(namespace, ttl);
    }

    createRequest(href, init = {}) {
        return new Request(href, init);
    }

    createHttpCookies({ request, ...rest }) {
        return this.constructor.HttpCookies.create({ request, ...rest });
    }

    createHttpSession({ store, request, ...rest }) {
        return this.constructor.HttpSession.create({ store, request, ...rest });
    }

    createHttpUser({ store, request, session, client, ...rest }) {
        return this.constructor.HttpUser.create({ store, request, session, client, ...rest });
    }

    createHttpEvent({ request, cookies, session, user, client, detail, signal, state, ...rest }) {
        return this.constructor.HttpEvent.create(null, { request, cookies, session, user, client, detail, signal, state, ...rest });
    }

    async dispatchNavigationEvent({ httpEvent, crossLayerFetch, clientPortB }) {
        const { flags: FLAGS, logger: LOGGER } = this.cx;
        // Resolve rid before dispatching
        if (httpEvent.request.method === 'GET' && httpEvent.url.query['_rid']) {
            const requestMeta = _wq(httpEvent.request, 'meta');
            requestMeta.set('redirectID', httpEvent.url.query['_rid']);
            requestMeta.set('carries', [].concat(await httpEvent.session.get(`carry-store:${requestMeta.get('redirectID')}`) || []));
            await httpEvent.session.delete(`carry-store:${requestMeta.get('redirectID')}`);
        }
        // Dispatch event
        const router = new this.constructor.Router(this, httpEvent.url.pathname);
        await router.route(['SETUP'], httpEvent.extend(false));
        // Do proper routing for respone
        const response = await new Promise(async (resolve) => {
            let autoLiveResponse, response;
            httpEvent.client.wqLifecycle.messaging.then(() => {
                autoLiveResponse = new LiveResponse(null, { status: 202, statusText: 'Accepted', done: false });
                resolve(autoLiveResponse);
            });
            const route = async () => {
                const routeMethods = [httpEvent.request.method, 'default'];
                const remoteFetch = (...args) => this.remoteFetch(...args);
                return await router.route(routeMethods, httpEvent, crossLayerFetch, remoteFetch);
            };
            const fullRoutingPipeline = this.bootstrap.middlewares.concat(route);
            try {
                response = await fullRoutingPipeline.reverse().reduce((next, fn) => {
                    return () => fn.call(this.cx, httpEvent, next);
                }, null)()/*immediately calling the first*/;
            } catch (e) {
                console.error(e);
                response = new Response(null, { status: 500, statusText: e.message });
            }
            if (!/Response/.test(LiveResponse.test(response))) {
                const isLifecyleComplete = httpEvent.lifeCycleComplete();
                response = LiveResponse.test(response) !== 'Default' || !isLifecyleComplete
                    ? await LiveResponse.from(response, { done: isLifecyleComplete })
                    : responseShim.from.value(response);
            }
            // Any "carry" data?
            //await this.handleCarries(httpEvent, response);
            // Resolve now...
            if (autoLiveResponse) {
                await autoLiveResponse.replaceWith(response, { done: true });
            } else {
                resolve(response);
            }
        });

        // Commit data in the exact order. Reason: in how they depend on each other
        for (const storage of [httpEvent.user, httpEvent.session, httpEvent.cookies]) {
            await storage?.commit?.(response, FLAGS['dev']);
        }
        // Wait for any whileLive promises to resolve
        if (LiveResponse.test(response) === 'LiveResponse' && response.whileLive()) {
            httpEvent.waitUntil(response.whileLive(true));
        }

        // Send the X-Background-Messaging-Port header
        // This server's event lifecycle management
        if (!httpEvent.lifeCycleComplete()) {
            if (this.isClientSide) {
                const responseMeta = _wq(response, 'meta');
                responseMeta.set('background_port', clientPortB);
            } else {
                const upstreamBackgroundPort = response.headers.get('X-Background-Messaging-Port');
                response.headers.set('X-Background-Messaging-Port', clientPortB);
            }

            // On navigation:
            // Abort httpEvent.client and httpEvent itself
            httpEvent.client.addEventListener('navigate', (e) => {
                setTimeout(() => { // Allow for global handlers to see the events
                    if (e.defaultPrevented) {
                        LOGGER.log(`Client Messaging Port on ${httpEvent.request.url} not auto-closed on user navigation.`);
                    } else {
                        httpEvent.client.close();
                        httpEvent.abort();
                    }
                }, 0);
            });
            // On close:
            // Abort httpEvent itself
            httpEvent.client.wqLifecycle.close.then(() => {
                httpEvent.abort();
            });

            // On ROOT event complete:
            // Close httpEvent.client
            httpEvent.lifeCycleComplete(true).then(() => {
                httpEvent.client.close();
            });
        }

        if (!this.isClientSide && LiveResponse.test(response) === 'LiveResponse') {
            // Must convert to Response on the server-side before returning
            return await response.toResponse({ client: httpEvent.client });
        }

        return response;
    }

    async handleCarries(httpEvent, response) {
        const requestMeta = _wq(httpEvent.request, 'meta');
        const responseMeta = _wq(response, 'meta');
        if (response.headers.get('Location')) {
            // Don't emit the supposedly incoming "carries"
            // Save back to URL
            if (requestMeta.get('carries')?.length) {
                await httpEvent.session.set(`carry-store:${requestMeta.get('redirectID')}`, requestMeta.get('carries'));
                requestMeta.set('carries', []);
            }
            // Stash current byte of "carry"
            if (responseMeta.has('carry')) {
                const $url = new URL(response.headers.get('Location'), httpEvent.request.url);
                if ($url.searchParams.has('_rid')) {
                    // If the URL already has a rid, append the new one
                    const existingRedirectID = $url.searchParams.get('_rid');
                    const existingData = await httpEvent.session.get(`carry-store:${existingRedirectID}`);
                    const combinedData = [].concat(responseMeta.get('carry'), existingData || []);
                    // Save the combined data back to the session
                    await httpEvent.session.set(`carry-store:${existingRedirectID}`, combinedData);
                } else {
                    // If not, create a new rid
                    const redirectID = (0 | Math.random() * 9e6).toString(36);
                    $url.searchParams.set('_rid', redirectID);
                    await httpEvent.session.set(`carry-store:${redirectID}`, [].concat(responseMeta.get('carry')));
                }
            }
        } else {
            // Fire redirect message?
            const flashResponses = requestMeta.get('carries')?.map((c) => c.response).filter((r) => r);
            if (flashResponses?.length) {
                httpEvent.waitUntil(new Promise((resolve) => {
                    httpEvent.client.wqLifecycle.open.then(() => {
                        httpEvent.client.postMessage(flashResponses, { wqEventOptions: { type: 'flash' } });
                        resolve();
                    }, { once: true });
                }));
            }
            requestMeta.set('carries', []);
        }
    }

    streamSlice(stream, { start, end }) {
        let bytesRead = 0;
        const reader = stream.getReader();
        return new ReadableStream({
            async pull(controller) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        break;
                    }
                    let chunk = value;
                    let chunkStart = bytesRead;
                    let chunkEnd = bytesRead + chunk.length;
                    if (chunkEnd <= start) {
                        // skip entire chunk
                        bytesRead += chunk.length;
                        continue;
                    }
                    if (chunkStart > end) {
                        // past requested range
                        controller.close();
                        break;
                    }
                    // slice relevant part
                    let sliceStart = Math.max(start - chunkStart, 0);
                    let sliceEnd = Math.min(end - chunkStart + 1, chunk.length);
                    controller.enqueue(chunk.subarray(sliceStart, sliceEnd));
                    bytesRead += chunk.length;
                    if (chunkEnd > end) {
                        controller.close();
                        break;
                    }
                }
            },
            cancel(reason) {
                reader.cancel(reason);
            }
        });
    }

    streamJoin(streams, contentType, totalLength) {
        // Single stream?
        if (streams.length === 1) {
            return streams[0];
        }
        // Multipart!
        const boundary = `WEBFLO_BOUNDARY_${Math.random().toString(36).slice(2)}`;
        const encoder = new TextEncoder();
        // Generator for multipart chunks
        async function* generateMultipart() {
            for (const { stream, start, end } of streams) {
                // Boundary + headers for each part
                yield encoder.encode(`--${boundary}\r\n`);
                yield encoder.encode(
                    `Content-Type: ${contentType}\r\n` +
                    `Content-Range: bytes ${start}-${end}/${totalLength}\r\n\r\n`
                );
                // Stream the sliced body
                const reader = stream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    yield value;
                }

                yield encoder.encode('\r\n');
            }
            // Final boundary
            yield encoder.encode(`--${boundary}--\r\n`);
        }
        // Create ReadableStream from async generator
        return {
            stream: new ReadableStream({
                async pull(controller) {
                    const gen = generateMultipart();
                    while (true) {
                        const { done, value } = await gen.next();
                        if (done) {
                            controller.close();
                            break;
                        }
                        controller.enqueue(value);
                    }
                },
                cancel(reason) {
                    // Handle cancellation if needed
                }
            }),
            boundary,
        };
    }

    createStreamingResponse(httpEvent, readStream, stats) {
        let response;
        const requestRange = headersShim.get.value.call(httpEvent.request.headers, 'Range', true); // Parses the Range header
        if (requestRange.length) {
            const streams = requestRange.reduce((streams, range) => {
                if (!streams) return;
                const [start, end] = range.render(stats.size); // Resolve offsets
                const currentStart = (streams[streams.length - 1]?.end || -1) + 1;
                if (!range.isValid(currentStart, stats.size)) return; // Only after rendering()
                return streams.concat({ start, end, stream: readStream({ start, end }) });
            }, []);
            if (!streams) {
                return new Response(null, {
                    status: 416, statusText: 'Requested Range Not Satisfiable', headers: {
                        'Content-Range': `bytes */${stats.size}`,
                    }
                });
            }
            const streamJoin = this.streamJoin(streams, stats.mime, stats.size);
            response = new Response(streamJoin.stream, { status: 206, statusText: 'Partial Content' });
            if (streamJoin.boundary) {
                response.headers.set('Content-Type', `multipart/byteranges; boundary=${streamJoin.boundary}`);
            } else {
                response.headers.set('Content-Type', stats.mime);
                response.headers.set('Content-Range', `bytes ${streamJoin.start}-${streamJoin.end}/${stats.size}`);
                response.headers.set('Content-Length', streamJoin.end - streamJoin.start + 1);
            }
        } else {
            response = new Response(readStream(), { status: 200, statusText: 'OK' });
            response.headers.set('Content-Type', stats.mime);
            response.headers.set('Content-Length', stats.size);
        }
        return response;
    }
}