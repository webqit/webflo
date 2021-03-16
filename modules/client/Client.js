
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

export default function(params) {

	// Copy..
	params = {...params};
	window.addEventListener('online', () => Observer.set(networkWatch, 'online', navigator.onLine));
	window.addEventListener('offline', () => Observer.set(networkWatch, 'online', navigator.onLine));
	var networkProgressOngoing;

	/**
	 * ----------------
	 * Apply routing
	 * ----------------
	 */	
	Http.createClient(async (request, initCall) => {

        // -------------------
        // Resolve canonicity
        // -------------------

		// The srvice object
		const flow = {
			onHydration: initCall && (await window.WQ.OOHTML.meta('isomorphic')),
			location: Url.parseUrl(request.url),
			params,
			request,
			data: null,
		}
		
		// The app router
		const requestPath = flow.location.pathname;
		const router = new Router(requestPath, params);
		if (networkProgressOngoing) {
			networkProgressOngoing.setActive(false);
			networkProgressOngoing = null;
		}

		try {

			// --------
			// ROUTE FOR DATA
			// --------
			flow.data = await router.route([flow], 'default', async function(output) {
				if (arguments.length) {
					return output;
				}
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true);
				// -----------------
				var requestUrl = request.url.includes('?') ? request.url + '&webfloapi=1' : request.url + '?webfloapi=1';
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
			});

			// --------
			// Render
			// --------
			await window.WQ.DOM.ready;
			const _window = await router.route([flow.data || {}], 'render', async function(_window) {
				if (arguments.length) {
					return _window;
				}
				// --------
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration: flow.onHydration,
						network: networkWatch,
					}, {update: true});
				}
				window.document.setState({page: flow.data, location: flow.location}, {update: true});
				window.document.body.setAttribute('template', 'page' + requestPath);

				return window;
			});

			setTimeout(() => {
				var urlTarget;
				if (flow.location.hash && (urlTarget = document.querySelector(flow.location.hash))) {
					urlTarget.scrollIntoView(true);
				} else {
					document.documentElement.classList.add('scroll-reset');
					window.scroll({top: 0, left: 0});
					setTimeout(() => {
						document.documentElement.classList.remove('scroll-reset');
					}, 400);
				}
            }, 0);

			// --------
			// Render...
			// --------

			await window.WQ.DOM.templatesReady;

			return flow.data;

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