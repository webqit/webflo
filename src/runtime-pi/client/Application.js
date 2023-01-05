
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
			// --------
			// ROUTE FOR DATA
			// --------
			return router.route([httpEvent.request.method, 'default'], httpEvent, { ...( document.state?.data || {} ) }, async event => {
				if (event !== httpEvent) {
					// This was nexted()
					if (!event.request.headers.has('Accept')) {
						event.request.headers.set('Accept', 'application/json');
					}
				}
				return remoteFetch(event.request);
			}, remoteFetch);
		};
		// --------
        // PIPE THROUGH MIDDLEWARES
        // --------
		return await (this.cx.middlewares || []).concat(handle).reverse().reduce((next, fn) => {
			return () => fn.call(this.cx, httpEvent, router, next);
		}, null)();
	}

	// Renderer
    async render(httpEvent, response) {
		let data = await response.jsonfy();
		const router = new this.Router(this.cx, httpEvent.url.pathname);
		return router.route('render', httpEvent, data, async (httpEvent, data) => {
			// --------
			// OOHTML would waiting for DOM-ready in order to be initialized
			if (window.WebQit.DOM) {
				await new Promise(res => window.WebQit.DOM.ready(res));
			}
			if (window.document.state) {
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration: (httpEvent.detail || {}).srcType === 'hydration',
						network: this.cx.runtime.network,
						url: this.cx.runtime.location,
					}, { update: true });
				}
				window.document.setState({ data }, { update: 'merge' });
			}
			if (window.document.templates) {
				window.document.body.setAttribute('template', 'routes/' + httpEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
				await new Promise(res => (window.document.templatesReadyState === 'complete' && res(), window.document.addEventListener('templatesreadystatechange', res)));
			}
			await this.scrollIntoView(httpEvent);
			return window;
		});
	}

	// Unrender
	async unrender(httpEvent) {
		if (window.document.state) {
			window.document.setState({ data: {} }, { update: 'merge' });
		}
	}

	// Normalize scroll position
	async scrollIntoView(httpEvent) {
		if (!(httpEvent.detail.srcType === 'link')) return;
		await new Promise(res => setTimeout(res, 10));
		let viewportTop, urlTarget;
		if (httpEvent.url.hash && (urlTarget = document.querySelector(httpEvent.url.hash))) {
			urlTarget.scrollIntoView();
		} else if (viewportTop = Array.from(document.querySelectorAll('[data-viewport-top]')).pop()) {
			viewportTop.focus();
		} else {
			document.body.scrollIntoView();
		}
	}

}

