
/**
 * @imports
 */
import Router from './Router.js';
import _Application from '../Application.js';
import { _isObject } from '@webqit/util/js/index.js';

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
		const router = new this.Router(this.cx, httpEvent.url.pathname);
		const handle = async () => {
			let bindingsConfig;
			if (window.webqit?.oohtml?.configs) { ({ BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs); }
			return router.route([httpEvent.request.method, 'default'], httpEvent, { ...((bindingsConfig && (navigationContext || document)[bindingsConfig.bindings]) || {}) }, async event => {
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
	async render(httpEvent, data, navigationContext = null) {
		const { location, referrer, network } = this.cx.runtime;
		const router = new this.Router(this.cx, location.pathname);
		return await router.route('render', httpEvent, data, async (httpEvent, data) => {
			if (window.webqit?.dom) { await new Promise(res => window.webqit.dom.ready(res)); }
			if (window.webqit?.oohtml?.configs) {
				const {
					BINDINGS_API: { api: bindingsConfig } = {},
					HTML_IMPORTS: { attr: modulesContextAttrs } = {},
				} = window.webqit.oohtml.configs;
				if (bindingsConfig && _isObject(data)) {
					if (navigationContext) {
						navigationContext[bindingsConfig.bind]({
							data
						}, { diff: true });
					} else {
						window.document[bindingsConfig.bind]({
							env: 'client',
							location,
							referrer,
							network, // request, redirect, error, status, remote
							data
						}, { diff: true });
					}
				}
				if (modulesContextAttrs && !navigationContext) {
					const newRoute = '/' + `routes/${location.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
					window.document.body.setAttribute(modulesContextAttrs.importscontext, newRoute);
				}
			}
		});
	}
}

