
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
	async handle(httpEvent, remoteFetch, navigationContext = null) {
		// The app router
        const router = new this.Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
			let bindingsConfig;
			if (window.webqit?.oohtml?.configs) { ( { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs ); }
			return router.route([httpEvent.request.method, 'default'], httpEvent, { ...( ( bindingsConfig && (navigationContext || document)[bindingsConfig.bindings] ) || {} ) }, async event => {
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
    async render(httpEvent, response, navigationContext = null) {
		const data = await response.parse();
		// Notice that we're using this.cx.runtime.location not httpEvent.url as the former is what will pick up response.url
		const { location, referrer, network } = this.cx.runtime;
		const execRender = async (httpEvent, data) => {
			if (window.webqit?.dom) { await new Promise(res => window.webqit.dom.ready(res)); }
			if (window.webqit?.oohtml?.configs) {
				const {
					CONTEXT_API: { attr: contextConfig } = {},
					BINDINGS_API: { api: bindingsConfig } = {},
					HTML_IMPORTS: { attr: modulesContextAttrs } = {},
				} = window.webqit.oohtml.configs;
				if ( bindingsConfig ) {
					(navigationContext || window.document)[ bindingsConfig.bind ]({
						env: 'client',
						location,
						referrer,
						network, // request, redirect, error, status, remote
						data,
					}, { diff: true });
				}
				if ( modulesContextAttrs ) {
					const newRoute = '/' + `routes/${ location.pathname }`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
					(navigationContext || window.document.body).setAttribute( modulesContextAttrs.importscontext, newRoute );
				}
			}
			return {};
		};
		const router = new this.Router(this.cx, location.pathname);
		return await router.route('render', httpEvent, data, execRender);
	}
}

