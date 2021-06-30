
/**
 * @imports
 */
import _isObject from '@webqit/util/js/isObject.js';
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

OOHTML.call(window);

/**
 * ---------------------------
 * The Client Initializer
 * ---------------------------
 */

export default function(layout, params) {

	// Copy..
	layout = {...layout};
	params = {...params};
	window.addEventListener('online', () => Observer.set(networkWatch, 'online', navigator.onLine));
	window.addEventListener('offline', () => Observer.set(networkWatch, 'online', navigator.onLine));
	var networkProgressOngoing;

	/**
	 * ----------------
	 * Apply routing
	 * ----------------
	 */	
	Http.createClient(async function(request, event = null) {

		const httpInstance = this;

        // -------------------
        // Resolve canonicity
        // -------------------

		// The srvice object
		request.URL = Url.parseUrl(request.url);
		const $context = {
			layout,
			onHydration: !event && (await window.WebQit.OOHTML.meta.get('isomorphic')),
			response: null,
		}
		
		// The app router
		const requestPath = httpInstance.location.pathname;
		const router = new Router(requestPath, layout, $context);
		if (networkProgressOngoing) {
			networkProgressOngoing.setActive(false);
			networkProgressOngoing = null;
		}

		try {

			// --------
			// ROUTE FOR DATA
			// --------
			$context.response = await router.route('default', [request], null, async function() {
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true);
				// -----------------
				const headers = request.headers || {};
				if (!request.headers.get('accept')) {
					if (headers.append) {
						headers.append('accept', 'application/json');
					} else {
						headers['accept'] = 'application/json';
					}
				}
				const response = _fetch(request, {}, networkProgress.updateProgress.bind(networkProgress));
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
			const rendering = await router.route('render', [request], $context.response, async function(data) {
				// --------
				// OOHTML would waiting for DOM-ready in order to be initialized
				await new Promise(res => window.WebQit.DOM.ready(res));
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration: $context.onHydration,
						network: networkWatch,
						location: httpInstance.location,
					}, {update: true});
				}
				window.document.setState({page: data, url: request.URL}, {update: true});
				window.document.body.setAttribute('template', 'page' + requestPath);
				return new Promise(res => {
					window.document.addEventListener('templatesreadystatechange', () => res(window));
					if (window.document.templatesReadyState === 'complete') {
						res(window);
					}
				});;
			}, []);

			// --------
			// Render...
			// --------

			if (_isObject(rendering) && rendering.document) {
				//$context.response = window.print();
			} else {
				//$context.response = rendering;
			}

			if (event && _isObject(event.detail) && (event.detail.src instanceof Element)) {
				setTimeout(() => {
					var urlTarget;
					if (httpInstance.location.hash && (urlTarget = document.querySelector(httpInstance.location.hash))) {
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