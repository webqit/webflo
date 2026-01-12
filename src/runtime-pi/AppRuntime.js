import { LiveResponse, ResponsePlus } from '@webqit/fetch-plus';
import { WebfloRouter111 } from './webflo-routing/WebfloRouter111.js';
import { AppBootstrap } from './AppBootstrap.js';
import { _meta } from '../util.js';

export class AppRuntime {

    #instanceController = new AbortController;
    get $instanceController() { return this.#instanceController; }

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

    createRequest(href, init = {}) {
        return new Request(href, init);
    }

    async dispatchNavigationEvent({ httpEvent, crossLayerFetch, clientPortB }) {
        const { flags: FLAGS, logger: LOGGER } = this.cx;

        // Dispatch event
        const router = new WebfloRouter111(this, httpEvent.url.pathname);
        await router.route(['SETUP'], httpEvent.spawn());

        // Do proper routing for respone
        const response = await new Promise(async (resolve) => {
            let autoLiveResponse, response;

            httpEvent.client.readyStateChange('messaging').then(() => {
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

            if (autoLiveResponse) {
                await this.handleThreadStatus(httpEvent, response);
                await autoLiveResponse.replaceWith(response, { done: true });
                return;
            }

            if (response instanceof Response) {
                ResponsePlus.upgradeInPlace(response);
            } else if (!(response instanceof LiveResponse)) {
                const isLifecyleComplete = ['waiting', 'done'].includes(httpEvent.readyState);
                response = LiveResponse.test(response) !== 'Default' || !isLifecyleComplete
                    ? LiveResponse.from(response, { done: isLifecyleComplete })
                    : ResponsePlus.from(response);
            }

            // Any "status" in thread?
            await this.handleThreadStatus(httpEvent, response);
            resolve(response);
        });

        // End-of-life cleanup
        const cleanup = async () => {
            await Promise.all([httpEvent.thread, httpEvent.user, httpEvent.session, httpEvent.cookies].map((x) => x._cleanup()));
        };

        // Wait for any "live" response to resolve
        if (response instanceof LiveResponse && response.readyState !== 'done') {
            httpEvent.waitUntil(response.readyStateChange('done'));
            httpEvent.waitUntil(httpEvent.client.readyStateChange('open').then(async () => {
                await new Promise((r) => setTimeout(r, 100));
            }));
        }

        // Send the X-Message-Port header
        // This server's event lifecycle management
        if (!['waiting', 'done'].includes(httpEvent.readyState)) {
            if (this.isClientSide) {
                LiveResponse.attachPort(response, clientPortB);
            } else {
                response.headers.set('X-Message-Port', clientPortB);
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
            httpEvent.client.readyStateChange('close').then(() => {
                httpEvent.abort();
            });

            // On ROOT event complete:
            // Close httpEvent.client
            httpEvent.readyStateChange('done').then(async () => {
                httpEvent.client.close();
                await cleanup();
            });
        } else await cleanup();

        if (!this.isClientSide
            && response instanceof LiveResponse) {
            // Must convert to Response on the server-side before returning
            const outgoingResponse = response.toResponse({ port: httpEvent.client });
            return outgoingResponse;
        }

        return response;
    }

    async handleThreadStatus(httpEvent, response) {
        if ((response instanceof Response
            || response instanceof LiveResponse)
            && response.headers.get('Location')) return;

        const status = await httpEvent.thread.consume('status', true);
        if (!status.length) return;

        httpEvent.waitUntil(httpEvent.client.readyStateChange('open').then(async () => {
            await new Promise((r) => setTimeout(r, 100));
            httpEvent.client.postMessage(status, { type: 'alert' });
            await new Promise((r) => setTimeout(r, 100));
        }));
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
        const requestRange = httpEvent.request.headers.get('Range', true); // Parses the Range header
        if (requestRange.length) {
            const streams = requestRange.reduce((streams, range) => {
                if (!streams) return;
                const [start, end] = range.resolveAgainst(stats.size); // Resolve offsets
                const currentStart = (streams[streams.length - 1]?.end || -1) + 1;
                if (!range.canResolveAgainst(currentStart, stats.size)) return; // Only after rendering()
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