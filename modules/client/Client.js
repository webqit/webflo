
/**
 * @imports
 */
import _fetch from '@webqit/browser-pie/src/apis/fetch.js';
import { OOHTML, Observer } from '@webqit/pseudo-browser/index2.js';
import Router from './Router.js';
import Http from './Http.js';
import Url from './Url.js';

/**
 * ---------------------------
 * OOHTML
 * ---------------------------
 */

OOHTML(window);

/**
 * ---------------------------
 * The Client Initializer
 * ---------------------------
 */

export default function(layout) {

	// Copy..
	layout = {...layout};
	window.addEventListener('online', () => Observer.set(networkWatch, 'online', navigator.onLine));
	window.addEventListener('offline', () => Observer.set(networkWatch, 'online', navigator.onLine));
	var networkProgressOngoing;

	/**
	 * ----------------
	 * Apply routing
	 * ----------------
	 */	
	Http.createClient(async (request, src, initCall) => {

        // -------------------
        // Resolve canonicity
        // -------------------

		// The srvice object
		request.URL = Url.parseUrl(request.url);
		const $context = {
			onHydration: initCall && (await window.WQ.OOHTML.meta('isomorphic')),
			url: Url.parseUrl(request.url),
			layout,
			request,
			data: null,
		}
		
		// The app router
		const requestPath = request.URL.pathname;
		const router = new Router(requestPath, layout, $context);
		if (networkProgressOngoing) {
			networkProgressOngoing.setActive(false);
			networkProgressOngoing = null;
		}

		try {

			// --------
			// ROUTE FOR DATA
			// --------
			$context.data = await router.route('default', [request], null, async function() {
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true);
				// -----------------
				var requestUrl_ = /*request.url*/this.pathname;
				var requestUrl = requestUrl_.includes('?') ? requestUrl_ + '&webfloapi=1' : requestUrl_ + '?webfloapi=1';
				const response = _fetch(requestUrl, {
					headers: {accept: 'application/json',},
				}, networkProgress.updateProgress.bind(networkProgress));
				// -----------------
				response.catch(e => networkProgress.throw(e.message));
				return response.then(response => {
					if (!networkProgress.active) {
						return new Promise(() => {});
					}
					networkProgress.setActive(false);
					return response.ok ? response.json() : null;
				});
			}, []);

			// --------
			// Render
			// --------
			await window.WQ.DOM.ready;
			const _window = await router.route('render', [], $context.data, async function() {
				// --------
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration: $context.onHydration,
						network: networkWatch,
					}, {update: true});
				}
				window.document.setState({page: $context.data, url: request.URL}, {update: true});
				window.document.body.setAttribute('template', 'page' + requestPath);

				return window;
			});

			if (src && (src instanceof Element)) {
				setTimeout(() => {
					var urlTarget;
					if (request.URL.hash && (urlTarget = document.querySelector(request.URL.hash))) {
						urlTarget.scrollIntoView(true);
					} else {
						document.documentElement.classList.add('scroll-reset');
						window.scroll({top: 0, left: 0});
						setTimeout(() => {
							document.documentElement.classList.remove('scroll-reset');
						}, 400);
					}
				}, 0);
			}

			// --------
			// Render...
			// --------

			await window.WQ.DOM.templatesReady;

			return $context.data;

		} catch(e) {

			window.document.body.setAttribute('template', '');
			throw e;

		}
		
	});

};

const networkWatch = {progress: {}, online: navigator.onLine};
class RequestHandle {
	setActive(state) {
		if (this.active === false) {
			return;
		}
		this.active = state;
		Observer.set(networkWatch, {
			error: '',
			progress: {
				active: state, 
				determinate: false,
				valuenow: 0,
				valuetotal: NaN,
			},
		});
	}
	updateProgress(phase, valuenow, valuetotal) {
		if (this.active === false) {
			return;
		}
		Observer.set(networkWatch.progress, {
			phase,
			determinate: !isNaN(valuetotal),
			valuenow,
			valuetotal,
		});
	}
	throw(message) {
		if (this.active === false) {
			return;
		}
		this.error = true;
		Observer.set(networkWatch, 'error', message);
	}
};