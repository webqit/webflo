import { _isObject } from '@webqit/util/js/index.js';

export class WebfloRuntime {

    async dispatch(httpEvent, context, crossLayerFetch) {
        // Exec routing
        const router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
        const route = async () => {
            return await router.route([httpEvent.request.method, 'default'], httpEvent, context, async (event) => {
                return crossLayerFetch(event);
            }, (...args) => this.remoteFetch(...args));
        };
        try {
            // Route for response
            return await (this.cx.middlewares || []).concat(route).reverse().reduce((next, fn) => {
                return () => fn.call(this.cx, httpEvent, router, next);
            }, null)();
            
        } catch (e) {
            console.error(e);
            return new Response(null, { status: 500, statusText: e.message });
        }
    }

    async normalizeResponse(httpEvent, response, forceCommit = false) {
        // Normalize response
        if (!(response instanceof Response)) {
            response = typeof response === 'undefined'
                ? new Response(null, { status: 404 })
                : Response.create(response);
        }
        // Commit data
        for (const storage of [httpEvent.cookies, httpEvent.session, httpEvent.storage]) {
            await storage?.commit?.(response, forceCommit);
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