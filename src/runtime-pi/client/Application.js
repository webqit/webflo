
/**
 * @imports
 */
import Router from './Router.js';
import _Application from '../Application.js';

export default class Application extends _Application {

	// Returns router class
	get Router() {
		return Router;
	}

	/**
     * Handles HTTP events.
     * 
     * @param HttpEvent       httpEvent
     * @param Function        remoteFetch
     * 
     * @return Response
     */
	async handle(httpEvent, remoteFetch) {
		// The app router
        const router = new this.Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
			let bindingsConfig;
			if (window.webqit?.oohtml?.configs) { ( { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs ); }
			return router.route([httpEvent.request.method, 'default'], httpEvent, { ...( ( bindingsConfig && document[bindingsConfig.bindings] ) || {} ) }, async event => {
				if (event !== httpEvent) {
					// This was nexted()
					if (!event.request.headers.has('Accept')) {
						event.request.headers.set('Accept', 'application/json');
					}
				}
				return remoteFetch(event.request);
			}, remoteFetch);
		};
		return await (this.cx.middlewares || []).concat(handle).reverse().reduce((next, fn) => {
			return () => fn.call(this.cx, httpEvent, router, next);
		}, null)();
	}

	// Renderer
    async render(httpEvent, response) {
		let data = await response.jsonfy();
		const router = new this.Router(this.cx, httpEvent.url.pathname);
		return await router.route('render', httpEvent, data, async (httpEvent, data) => {
			if (window.webqit?.dom) { await new Promise(res => window.webqit.dom.ready(res)); }
			if (window.webqit?.oohtml?.configs) {
				const {
					CONTEXT_API: { attr: contextConfig } = {},
					BINDINGS_API: { api: bindingsConfig } = {},
					HTML_IMPORTS: { attr: modulesContextAttrs } = {},
				} = window.webqit.oohtml.configs;
				if ( bindingsConfig ) {
					window.document[ bindingsConfig.bind ]({
						env: 'client', state: this.cx.runtime, ...(data || {})
					}, { diff: true });
				}
				let routingContext;
				if ( modulesContextAttrs ) {
					routingContext = window.document.body.querySelector(`[${ window.CSS.escape( contextConfig.contextname ) }="app"]`) || window.document.body;
					const prevRoute = routingContext.getAttribute( modulesContextAttrs.importscontext );
					const newRoute = '/' + `routes/${ httpEvent.url.pathname }`.split('/').map(a => a.trim()).filter(a => a).join('/');
					const rel = prevRoute === newRoute ? 'same' : ( `${ prevRoute }/`.startsWith( `${ newRoute }/` ) ? 'parent' : ( `${ newRoute }/`.startsWith( `${ prevRoute }/` ) ? 'child' : 'unrelated' ) );
					routingContext.setAttribute( modulesContextAttrs.importscontext, newRoute);
					routingContext.setAttribute( `prev-${ modulesContextAttrs.importscontext }`, prevRoute );
					routingContext.setAttribute( 'importscontext-transition-type', rel );
				}
			}
			return window;
		});
	}
}

