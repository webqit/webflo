
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
				const _response = fetch(event.request);
				// This catch() is NOT intended to handle failure of the fetch
				_response.catch(e => networkProgress.throw(e.message));
				// Save a reference to this
				return _response.then(async response => {
					response = new clientNavigationEvent.Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
						_proxy: {
							url: response.url,
							ok: response.ok,
							redirected: response.redirected
						},
					});
					if (response.headers.get('Location')) {
						networkProgress.redirecting(response.headers.get('Location'));
					}
					// Stop loading status
					networkProgress.setActive(false);
					return response;
				});
			});
			if ($context.response instanceof clientNavigationEvent.Response) {
				$context.data = await $context.response.data();
            } else {
				$context.data = $context.response;
			}

			// --------
			// Render
			// --------
			const rendering = await router.route('render', clientNavigationEvent, $context.data, async function(event, data) {
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
		
		return $context.response;
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
	redirecting(location) {
		Observer.set(networkWatch, 'redirecting', location);
	}
	throw(message) {
		if (this.active === false) {
			return;
		}
		this.error = true;
		Observer.set(networkWatch, 'error', message);
	}
};