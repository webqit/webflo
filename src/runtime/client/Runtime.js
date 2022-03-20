
/**
 * @imports
 */
import _isObject from '@webqit/util/js/isObject.js';
import _before from '@webqit/util/str/before.js';
import _unique from '@webqit/util/arr/unique.js';
import _fetch from '@webqit/browser-pie/src/apis/fetch.js';
import NavigationEvent from './NavigationEvent.js';
import WorkerClient from './WorkerClient.js';
import Storage from './Storage.js';
import Router from './Router.js';
import Http from './Http.js';

/**
 * ---------------------------
 * The Client Initializer
 * ---------------------------
 */

export const { Observer } = window.WebQit;
export default function(layout, params) {

	const session = Storage();
	const workerClient = new WorkerClient('/worker.js', { startMessages: true });
	Observer.observe(workerClient, changes => {
		console.log('SERVICE_WORKER_STATE', changes[0].name, changes[0].value);
	});

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
		const $context = {
			layout,
			onHydration: !event && (await window.WebQit.OOHTML.meta.get('isomorphic')),
			response: null,
		}
		
		// The app router
		const clientNavigationEvent = new NavigationEvent(request, session);
		const requestPath = clientNavigationEvent.url.pathname;
		const router = new Router(requestPath, layout, $context);
		if (networkProgressOngoing) {
			networkProgressOngoing.setActive(false);
			networkProgressOngoing = null;
		}

		try {

			// --------
			// ROUTE FOR DATA
			// --------
			const httpMethodName = clientNavigationEvent.request.method.toLowerCase();
			$context.response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], clientNavigationEvent, document.state, async function(event) {
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true, event.request._method || event.request.method);
				// -----------------
				const headers = event.request.headers;
				if (!headers.get('Accept')) {
					headers.set('Accept', 'application/json');
				}
				if (!headers.get('Cache-Control')) {
					headers.set('Cache-Control', 'no-store');
				}
				// -----------------
				// Sync session data to cache to be available to service-worker routers
				const response = fetch(event.request, {}, networkProgress.updateProgress.bind(networkProgress));
				// -----------------
				// -----------------
				response.catch(e => networkProgress.throw(e.message));
				return response.then(async _response => {
					_response = new clientNavigationEvent.Response(_response.body, {
						status: _response.status,
						statusText: _response.statusText,
						headers: _response.headers,
						_proxy: {
							url: _response.url,
							ok: _response.ok,
							redirected: _response.redirected
						},
					});
					// Save a reference to this
					$context.responseClone = _response;
					// Return a promise that never resolves as a new response is underway
					if (!networkProgress.active) {
						return new Promise(() => {});
					}
					// Stop loading status
					networkProgress.setActive(false);
					return _response;
				});
			});
			if ($context.response instanceof clientNavigationEvent.Response) {
                $context.response = await $context.response.jsonBuild();
            }

			// --------
			// Render
			// --------
			const rendering = await router.route('render', clientNavigationEvent, $context.response, async function(event, data) {
				// --------
				// OOHTML would waiting for DOM-ready in order to be initialized
				await new Promise(res => window.WebQit.DOM.ready(res));
				if (!window.document.state.env) {
					window.document.setState({
						env: 'client',
						onHydration: $context.onHydration,
						network: networkWatch,
						url: httpInstance.location,
						session,
					}, { update: true });
				}
				window.document.setState({ page: data }, { update: 'merge' });
				window.document.body.setAttribute('template', 'page/' + requestPath.split('/').filter(a => a).map(a => a + '+-').join('/'));
				return new Promise(res => {
					window.document.addEventListener('templatesreadystatechange', () => res(window));
					if (window.document.templatesReadyState === 'complete') {
						res(window);
					}
				});
			});

			// --------
			// Render...
			// --------

			if (/*document.activeElement === document.body && */event && _isObject(event.detail) && (event.detail.src instanceof Element) && /* do only on url path change */ _before(event.value, '?') !== _before(event.oldValue, '?')) {
				setTimeout(() => {
					let vieportTop;
					if (clientNavigationEvent.url.hash && (urlTarget = document.querySelector(clientNavigationEvent.url.hash))) {
						urlTarget.scrollIntoView();
					} else if (vieportTop = Array.from(document.querySelectorAll('[data-viewport-top]')).pop()) {
						vieportTop.focus();
					} else {
						document.documentElement.classList.add('scroll-reset');
						document.body.scrollIntoView();
						setTimeout(() => {
							document.documentElement.classList.remove('scroll-reset');
						}, 600);
					}
				}, 0);
			}

		} catch(e) {

			window.document.body.setAttribute('template', '');
			throw e;

		}
		
		return $context.responseClone;
	});

};

const networkWatch = { progress: {}, online: navigator.onLine };
class RequestHandle {
	setActive(state, method = '') {
		if (this.active === false) {
			return;
		}
		this.active = state;
		Observer.set(networkWatch, {
			method,
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