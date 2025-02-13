import { _isObject } from '@webqit/util/js/index.js';

export class WebfloRuntime {

    async setup(httpEvent) {
        const router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
        return await router.route(['SETUP'], httpEvent);
    }

    async dispatch(httpEvent, context, crossLayerFetch) {
        const requestLifecycle = {};
        requestLifecycle.responsePromise = new Promise(async (res) => {
            // Exec routing
            const router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
            const route = async () => {
                return await router.route([httpEvent.request.method, 'default'], httpEvent, context, async (event) => {
                    return crossLayerFetch(event);
                }, (...args) => this.remoteFetch(...args), requestLifecycle);
            };
            try {
                // Route for response
                res(await (this.cx.middlewares || []).concat(route).reverse().reduce((next, fn) => {
                    return () => fn.call(this.cx, httpEvent, router, next);
                }, null)());
            } catch (e) {
                console.error(e);
                res(new Response(null, { status: 500, statusText: e.message }));
            }
        });
        return await requestLifecycle.responsePromise;
   }

    async normalizeResponse(httpEvent, response) {
        // Normalize response
        if (!(response instanceof Response)) {
            response = typeof response === 'undefined'
                ? new Response(null, { status: 404 })
                : Response.create(response);
        }
        // Commit data
        for (const storage of [httpEvent.cookies, httpEvent.session, httpEvent.storage]) {
            await storage?.commit?.(response);
        }
        return response;
    }

    async execPush(clientPort, data) {
        if (data instanceof Response) {
            if ([301, 302, 303, 307, 308].includes(data.status) && data.headers.has('Location')) {
                clientPort.postMessage(data.headers.get('Location'), { messageType: 'redirect' });
                return;
            }
            data = await data.parse();
        }
        if (!_isObject(data)) {
            throw new Error('Response not serializable');
        }
        clientPort.postMessage(data, { messageType: 'response' });
    }
}