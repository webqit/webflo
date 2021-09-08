
/**
 * @imports
 */
import { OOHTML, Observer } from '@webqit/pseudo-browser/index2.js';
import _isObject from '@webqit/util/js/isObject.js';
import _before from '@webqit/util/str/before.js';
import _unique from '@webqit/util/arr/unique.js';
import _fetch from '@webqit/browser-pie/src/apis/fetch.js';
import NavigationEvent from '../NavigationEvent.js';
import WorkerClient from './WorkerClient.js';
import Router from './Router.js';
import Storage from './Storage.js';
import Http from './Http.js';

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

	const session = Storage();
	const store = Storage(true);
	const workerClient = new WorkerClient('/worker.js', { onWondowLoad: true, });
	workerClient.sharedStore(session, false, 2);
	Observer.observe(workerClient, changes => {
		console.log('SERVICE_WORKER', ...changes);
	});
	Observer.observe(session, changes => {
		console.log('SESSION', ...changes);
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
		const clientNavigationEvent = new NavigationEvent(request, request.url, session);
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
			$context.response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], clientNavigationEvent, null, async function() {
				// -----------------
				var networkProgress = networkProgressOngoing = new RequestHandle();
				networkProgress.setActive(true, clientNavigationEvent.request.method);
				// -----------------
				const headers = clientNavigationEvent.request.headers;
				if (!headers.get('Accept')) {
					headers.set('Accept', 'application/json');
				}
				if (!headers.get('Cache-Control')) {
					headers.set('Cache-Control', 'no-store');
				}
				// -----------------
				// Sync session data to cache to be available to service-worker routers
				const response = _fetch(clientNavigationEvent.request, {}, networkProgress.updateProgress.bind(networkProgress));
				// -----------------
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
			const rendering = await router.route('render', clientNavigationEvent, $context.response, async function(data) {
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

			if (_isObject(rendering) && rendering.document) {
				//$context.response = window.print();
			} else {
				//$context.response = rendering;
			}

			if (event && _isObject(event.detail) && (event.detail.src instanceof Element) && /* do only on url path change */ _before(event.value, '?') !== _before(event.oldValue, '?')) {
				setTimeout(() => {
					var urlTarget;
					if (clientNavigationEvent.url.hash && (urlTarget = document.querySelector(clientNavigationEvent.url.hash))) {
						urlTarget.scrollIntoView(true);
					} else {
						document.documentElement.classList.add('scroll-reset');
						window.scroll({top: 0, left: 0});
						setTimeout(() => {
							document.documentElement.classList.remove('scroll-reset');
						}, 200);
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