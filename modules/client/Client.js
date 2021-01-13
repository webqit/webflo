
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
		
		// The app router
		const location = Url.parseUrl(request.url);
		const requestPath = location.pathname;
		const router = new Router(requestPath, params);
		const onHydration = initCall && (await window.WQ.OOHTML.meta('isomorphic'));
		if (networkProgressOngoing) {
			networkProgressOngoing.setActive(false);
			networkProgressOngoing = null;
		}

		// The srvice object
		const service = {
			onHydration,
			params,
			request,
		}

		var data;
		try {

			// --------
			// ROUTE FOR DATA
			// --------
			data = await router.route([service], 'default', async function(output) {
				if (arguments.length) {
					return output;
				}
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true);
				// -----------------
				const request = _fetch(requestPath, {
					headers: {accept: 'application/json',},
				}, networkProgress.updateProgress.bind(networkProgress));
				// -----------------
				request.catch(e => networkProgress.throw(e.message));
				return request.then(response => {
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
			const _window = await router.route([data], 'render', async function(_window) {
				if (arguments.length) {
					return _window;
				}
				// --------
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration,
						network: 
						networkWatch,
					}, {update: true});
				}
				window.document.setState({page: data, location}, {update: true});
				window.document.body.setAttribute('template', 'page' + requestPath);

				return window;
			});

			window.scroll({top: 0, left: 0, behavior: 'auto'});

			// --------
			// Render...
			// --------

			await window.WQ.DOM.templatesReady;

			return data;

		} catch(e) { throw e }
		
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