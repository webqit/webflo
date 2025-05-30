import { _isTypeObject } from '@webqit/util/js/index.js';
import { meta } from './webflo-fetch/util.js';

export class WebfloRuntime {

    #instanceController = new AbortController;
    get $instanceController() { return this.#instanceController; }

    async initialize() {
        // Do init work
        return this.#instanceController;
    }

    async hydrate() {
        // Do hydration work
        return this.#instanceController;
    }

    control() {
        // Do control work
        return this.#instanceController;
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

	createHttpEvent({ request, cookies, session, user, client, sdk, detail, signal, state, ...rest }) {
		return this.constructor.HttpEvent.create(null, { request, cookies, session, user, client, sdk, detail, signal, state, ...rest });
	}

    async dispatchNavigationEvent({ httpEvent, crossLayerFetch, backgroundMessagingPort }) {
        const scopeObj = {};
        // ---------------------
        // Resolve rid before dispatching
        if (httpEvent.request.method === 'GET'
            && (httpEvent.request[meta].redirectID = httpEvent.url.query['_rid'])
            && (httpEvent.request[meta].carries = [].concat(await httpEvent.session.get(`carry-store:${httpEvent.request[meta].redirectID}`) || []))) {
            await httpEvent.session.delete(`carry-store:${httpEvent.request[meta].redirectID}`);
        }
        // ---------------------
        // Dispatch event
        const router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
        await router.route(['SETUP'], httpEvent);
        const route = async () => {
            return await router.route(
                [httpEvent.request.method, 'default'],
                httpEvent,
                (event) => crossLayerFetch(event),
                (...args) => this.remoteFetch(...args)
            );
        };
        try {
            scopeObj.returnValue = await (this.cx.middlewares || []).concat(route).reverse().reduce((next, fn) => {
                return () => fn.call(this.cx, httpEvent, router, next);
            }, null)();
        } catch (e) {
            console.error(e);
            scopeObj.returnValue = new Response(null, { status: 500, statusText: e.message });
        }
        scopeObj.response = scopeObj.returnValue;
        // ---------------------
        // Resolve return value
        if (this.isClientSide) {
            // Both LiveResponse and Response are supported
            if (!(scopeObj.response instanceof LiveResponse) && !(scopeObj.response instanceof Response)) {
                scopeObj.response = await LiveResponse.create(scopeObj.response);
            }
            // Wait until generator done
            if (scopeObj.response instanceof LiveResponse && !scopeObj.response.generatorDone) {
                httpEvent.waitUntil(new Promise((resolve) => {
                    httpEvent.client.addEventListener('close', resolve);
                    scopeObj.response.addEventListener('generatordone', () => {
                        if (!scopeObj.response.frameDone/*Closures AREN'T required on the client to indicate live frames*/) {
                            scopeObj.response.addEventListener('framedone', resolve, { once: true });
                        } else resolve();
                    }, { once: true });
                }));
            }
        } else {
            // Only normal Response (with streaming) supported
            let liveResponse, isStreamingResponse;
            if (!(scopeObj.response instanceof Response)) {
                liveResponse = await LiveResponse.create(scopeObj.response);
                // isStreamingResponse if originally a LiveResponse or is initialized from Generator|Quantum
                isStreamingResponse = scopeObj.returnValue/*ORIGINAL*/ instanceof LiveResponse || liveResponse.generatorType !== 'Default';
                // Convert to normal response with streaming enabled and streaming details applied
                scopeObj.response = liveResponse.toResponse({ clientMessagingPort: isStreamingResponse && httpEvent.client || null });
            }
            // Wait until generator done
            if (isStreamingResponse && !liveResponse.generatorDone) {
                httpEvent.waitUntil(new Promise((resolve) => {
                    httpEvent.client.addEventListener('close', resolve);
                    liveResponse.addEventListener('generatordone', () => {
                        if (!liveResponse.frameDone && liveResponse.hasFrameClosure/*Closures are required on the server to indicate live frames*/) {
                            liveResponse.addEventListener('framedone', resolve, { once: true });
                        } else resolve();
                    }, { once: true });
                }));
            }
        }
        // ----------------------
        // Any carryon data?
        await this.handleCarries(httpEvent, scopeObj.response);
        // ----------------------
        // Send the X-Background-Messaging-Port header?
        // !ORDER: Must after the live data-binding logic above
        // so that httpEvent.eventLifecyclePromises.size can capture the httpEvent.waitUntil()
        // !ORDER: Must come after having called this.handleCarries()
        // so that httpEvent.client.isMessaging() can capture any postMessage() there
        if (httpEvent.eventLifecyclePromises.size || httpEvent.client.isMessaging()) {
            if (typeof backgroundMessagingPort === 'string') {
                scopeObj.response.headers.set(
                    'X-Background-Messaging-Port',
                    backgroundMessagingPort
                );
            } else if (backgroundMessagingPort) {
                if (typeof backgroundMessagingPort !== 'function') {
                    throw new Error('backgroundMessagingPort must be a callback when not a string.');
                }
                scopeObj.response[meta].backgroundMessagingPort = backgroundMessagingPort;
            }
        }
        // ----------------------
        // Terminate live objects listeners
        // !ORDER: Must after the live data-binding logic above
        // so that httpEvent.eventLifecyclePromises.size can capture the httpEvent.waitUntil()
        Promise.all([...httpEvent.eventLifecyclePromises]).then(() => {
            if (httpEvent.client.isMessaging()) {
                httpEvent.client.on('open', () => {
                    setTimeout(() => {
                        httpEvent.client.close();
                    }, 100);
                });
            } else {
                httpEvent.client.close();
            }
        });
        // ----------------------
        // Commit data in the exact order. Reason: in how they depend on each other
        for (const storage of [httpEvent.user, httpEvent.session, httpEvent.cookies]) {
            await storage?.commit?.(scopeObj.response);
        }
        // ----------------------
        // Return normalized response
        return scopeObj.response;
    }

    async handleCarries(httpEvent, response) {
        if (response.headers.get('Location')) {
            if (response.carry) {
                const $url = new URL(response.headers.get('Location'), httpEvent.request.url);
                if ($url.searchParams.has('_rid')) {
                    // If the URL already has a rid, append the new one
                    const existingRedirectID = $url.searchParams.get('_rid');
                    const existingData = await httpEvent.session.get(`carry-store:${existingRedirectID}`);
                    const combinedData = [].concat(response.carry, existingData || []);
                    // Save the combined data back to the session
                    await httpEvent.session.set(`carry-store:${existingRedirectID}`, combinedData);
                } else {
                    // If not, create a new rid
                    const redirectID = (0 | Math.random() * 9e6).toString(36);
                    $url.searchParams.set('_rid', redirectID);
                    await httpEvent.session.set(`carry-store:${redirectID}`, [].concat(response.carry));
                }
            }
            // Save the supposedly next message back to URL
            if (httpEvent.request.carries.size) {
                await scopeObj.session.set(`carry-store:${httpEvent.request[meta].redirectID}`, [...httpEvent.request.carries]);
                httpEvent.request[meta]/*!IMPORTANT*/.carries = [];
            }
        } else {
            // Fire redirect message?
            const flashResponses = httpEvent.request[meta]/*!IMPORTANT*/.carries?.map((c) => c.response).filter((r) => r);
            if (flashResponses?.length) {
                await httpEvent.client.postMessage(flashResponses, { eventOptions: { type: 'flash' } });
                httpEvent.request[meta]/*!IMPORTANT*/.carries = [];
            }
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
        const rangeRequest = httpEvent.request.headers.get('Range', true); // Parses the Range header
        if (rangeRequest.length) {
            const streams = rangeRequest.reduce((streams, range) => {
                if (!streams || !range.isValid(stats.size)) return;
                const [start, end] = range.clamp(stats.size);
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