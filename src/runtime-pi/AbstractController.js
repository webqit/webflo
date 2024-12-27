export class AbstractController {

    async dispatch(httpEvent, context, crossLayerFetch) {
        const scope = {};
        // Exec routing
        scope.router = new this.constructor.Router(this.cx, httpEvent.url.pathname);
        scope.route = async () => {
            return scope.router.route([httpEvent.request.method, 'default'], httpEvent, context, async (event) => {
                return crossLayerFetch(event);
            }, (...args) => this.remoteFetch(...args));
        };
        try {
            // Route for response
            scope.response = await (this.cx.middlewares || []).concat(scope.route).reverse().reduce((next, fn) => {
                return () => fn.call(this.cx, httpEvent, scope.router, next);
            }, null)();
            // Normalize response
            if (!(scope.response instanceof Response)) {
                scope.response = typeof scope.response === 'undefined'
                    ? new Response(null, { status: 404 })
                    : Response.create(scope.response);
            }
            // Commit data
            for (const storage of [httpEvent.cookies, httpEvent.session, httpEvent.storage]) {
                await storage?.commit?.(scope.response);
            }
        } catch (e) {
            console.error(e);
            scope.response = new Response(e.message, { status: 500, statusText: e.message });
        }
        return scope.response;
    }
}