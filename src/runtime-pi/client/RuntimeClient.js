
/**
 * @imports
 */
import { Observer } from './Runtime.js';
import WorkerComm from './WorkerComm.js';
import Router from './Router.js';

export default class RuntimeClient {

	/**
     * RuntimeClient
     * 
     * @param Context cx
     */
	constructor(cx) {
		this.cx = cx;
		if (this.cx.support_service_worker) {
			const workerComm = new WorkerComm(this.cx.worker_filename, { scope: this.cx.worker_scope, startMessages: true });
			Observer.observe(workerComm, changes => {
				//console.log('SERVICE_WORKER_STATE_CHANGE', changes[0].name, changes[0].value);
			});
		}
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
        const router = new Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
			// --------
			// ROUTE FOR DATA
			// --------
			let httpMethodName = httpEvent.request.method.toLowerCase();
			let response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], httpEvent, {}, async event => {
				return remoteFetch(event.request);
			}, remoteFetch);
			if (!(response instanceof httpEvent.Response)) {
                response = new httpEvent.Response(response);
            }

            // --------
            // Rendering
            // --------
            if (response.ok && response.headers.contentType === 'application/json') {
                await this.render(httpEvent, response, router);
				await this.scrollIntoView(httpEvent);
            } else if (!response.ok) {
				await this.unrender();
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
    async render(httpEvent, response, router) {
		let data = await response.json();
		return router.route('render', httpEvent, data, async (httpEvent, data) => {
			// --------
			// OOHTML would waiting for DOM-ready in order to be initialized
			await new Promise(res => window.WebQit.DOM.ready(res));
			if (!window.document.state.env) {
				window.document.setState({
					env: 'client',
					onHydration: (httpEvent.detail || {}).srcType === 'init',
					network: this.cx.runtime.network,
					url: this.cx.runtime.location,
				}, { update: true });
			}
			window.document.setState({ page: data }, { update: 'merge' });
			window.document.body.setAttribute('template', 'page/' + httpEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
            await new Promise(res => (window.document.templatesReadyState === 'complete' && res(), window.document.addEventListener('templatesreadystatechange', res)));
			return window;
		});
	}

	// Unrender
	async unrender() {
		window.document.setState({ page: {} }, { update: 'merge' });
		window.document.body.setAttribute('template', '');
	}

	// Normalize scroll position
	async scrollIntoView(httpEvent) {
		if (!(httpEvent.detail.src instanceof Element)) return;
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

