
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
            return await router.route([httpEvent.request.method, 'default'], httpEvent, {}, async event => {
                return router.file(event);
            }, remoteFetch);
        };
        return (this.cx.middlewares || []).concat(handle).reverse().reduce((next, fn) => {
            return () => fn.call(this.cx, httpEvent, router, next);
        }, null)();
    }

    // Renderer
    async render(httpEvent, response) {
        let data = await response.parse();
		const router = new this.Router(this.cx, httpEvent.url.pathname);
        return router.route('render', httpEvent, data, async (httpEvent, data) => {
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
			if (window.webqit?.oohtml?.configs) {
				const {
				    CONTEXT_API: { attr: contextConfig } = {},
					BINDINGS_API: { api: bindingsConfig } = {},
					HTML_IMPORTS: { attr: modulesContextAttrs } = {},
				} = window.webqit.oohtml.configs;
                if ( bindingsConfig ) {
                    document[ bindingsConfig.bind ]({
                        env: 'server',
						location: this.cx.runtime.location,
						network: this.cx.runtime.network, // request, error, remote
						data,
                    }, { diff: true });
                }
                if ( modulesContextAttrs ) {
                    const routingContext = document.body.querySelector(`[${ window.CSS.escape( contextConfig.contextname ) }="route"]`) || document.body;
					const newRoute = '/' + `routes/${ httpEvent.url.pathname }`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                    routingContext.setAttribute( modulesContextAttrs.importscontext, newRoute );
                }
			}
            if (window.webqit.$qCompilerImport) {
                await new Promise(res => {
                    window.webqit.$qCompilerImport.then(res);
                    setTimeout(res, 300);
                });
            }
            await new Promise(res => setTimeout(res, 50));
            return window;
        });
    }

}