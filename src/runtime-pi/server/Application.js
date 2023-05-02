
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import QueryString from 'querystring';
import Router from './Router.js';
import _Application from '../Application.js';

export default class Application extends _Application {

    /**
     * Application
     * 
     * @param Context cx
     */
    constructor(cx) {
        super(cx);
        this.renderFileCache = {};
    }

	// Returns router class
	get Router() {
		return Router;
	}

    /**
     * Handles navigation events.
     * 
     * @param NavigationEvent       httpEvent
     * @param Function              remoteFetch
     * 
     * @return Response
     */
    async handle(httpEvent, remoteFetch) {
        // The app router
        const router = new this.Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
            // --------
            // ROUTE FOR DATA
            // --------
            let response = await router.route([httpEvent.request.method, 'default'], httpEvent, {}, async event => {
                return router.file(event);
            }, remoteFetch);
            if (!(response instanceof httpEvent.Response)) {
                response = httpEvent.Response.compat(response);
            }
            // --------
            // Rendering
            // --------
            if (response.ok && response.meta.type === 'json' && typeof response.meta.body === 'object' && response.meta.body && httpEvent.request.headers.accept.match('text/html')) {
                let rendering = await this.render(httpEvent, router, response);
                if (typeof rendering !== 'string' && !(typeof rendering === 'object' && rendering && typeof rendering.toString === 'function')) {
                    throw new Error('render() must return a string response or an object that implements toString()..');
                }
                rendering = rendering.toString();
                response = new httpEvent.Response(rendering, {
                    headers: { ...response.headers.json(), contentType: 'text/html', contentLength: (new Blob([rendering]).size) },
                    status: response.status,
                });
            }

            return response;
        };
        // --------
        // PIPE THROUGH MIDDLEWARES
        // --------
        return (this.cx.middlewares || []).concat(handle).reverse().reduce((next, fn) => {
            return () => fn.call(this.cx, httpEvent, router, next);
        }, null)();
    }

    // Renderer
    async render(httpEvent, router, response) {
        let data = await response.jsonfy();
        let rendering = await router.route('render', httpEvent, data, async (httpEvent, data) => {
            let renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
            && (this.renderFileCache[renderFile] === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.renderFileCache[renderFile] = false;
                pathnameSplit.pop();
            }
            const dirPublic = Url.pathToFileURL( Path.resolve( Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR) ) );
            const instanceParams = QueryString.stringify({
                file: renderFile,
                url: dirPublic.href,// httpEvent.url.href,
                root: this.cx.CWD,
            });
            const { window, document } = await import('@webqit/oohtml-ssr/src/instance.js?' + instanceParams);
            await new Promise(res => {
                if (document.readyState === 'complete') return res();
                document.addEventListener('load', res);
            });
			if (window.webqit && window.webqit.oohtml.configs) {
				const {
					BINDINGS_API: { api: bindingsConfig } = {},
					HTML_MODULES: { context: { attr: modulesContextAttrs } = {} } = {},
				} = window.webqit.oohtml.configs;
                if ( bindingsConfig ) {
                    document[ bindingsConfig.bind ]({
                        env: 'client',
                        state: this.cx.runtime,
                        ...data
                    }, { diff: true });
                }
                if ( modulesContextAttrs ) {
                    const routingContext = document.body.querySelector(`[${ window.CSS.escape( modulesContextAttrs.contextname ) }="routes"]`) || document.body;
                    routingContext.setAttribute( modulesContextAttrs.importscontext, '/' + `routes/${ httpEvent.url.pathname }`.split('/').map(a => a.trim()).filter(a => a).join('/'));
                }
			}
            await new Promise(res => setTimeout(res, 0));
            return window;
        });
        return rendering + '';
    }

}