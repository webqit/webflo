
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
import Navigator from './Navigator.js';

/**
 * ---------------------------
 * The Client Initializer
 * ---------------------------
 */

export const { Observer } = window.WebQit;
export default function(layout, params) {

	layout = {...layout};
	params = {...params};

	const session = Storage();
	const workerClient = new WorkerClient('/worker.js', { startMessages: true });
	const navigator = new Navigator(async (request, params, remoteFetch) => {
		
		// The navigation event
		const clientNavigationEvent = new NavigationEvent(
			new NavigationEvent.Request(request),
			session,
		);

		// The app router
		const router = new Router(clientNavigationEvent.url.pathname, layout, {
			layout,
			onHydration: params.srcType === 'init',
		});

		// --------
		// ROUTE FOR DATA
		// --------
		const httpMethodName = clientNavigationEvent.request.method.toLowerCase();
		const response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], clientNavigationEvent, document.state, async function(event) {
			return remoteFetch(event.request).then(response => {
				return new clientNavigationEvent.Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
					_proxy: {
						url: response.url,
						ok: response.ok,
						redirected: response.redirected
					},
				});
			});
		}).catch(e => {
			window.document.body.setAttribute('template', '');
			throw e;
		});


		// --------
		// Render
		// --------
		const data = response instanceof clientNavigationEvent.Response ? await response.data() : response;
		await router.route('render', clientNavigationEvent, data, async function(event, data) {
			// --------
			// OOHTML would waiting for DOM-ready in order to be initialized
			await new Promise(res => window.WebQit.DOM.ready(res));
			if (!window.document.state.env) {
				window.document.setState({
					env: 'client',
					onHydration: params.srcType === 'init',
					network: navigator.network,
					url: navigator.location,
					session,
				}, { update: true });
			}
			window.document.setState({ page: data }, { update: 'merge' });
			window.document.body.setAttribute('template', 'page/' + clientNavigationEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
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

		if (params.src instanceof Element) {
			setTimeout(() => {
				let viewportTop;
				if (clientNavigationEvent.url.hash && (urlTarget = document.querySelector(clientNavigationEvent.url.hash))) {
					urlTarget.scrollIntoView();
				} else if (viewportTop = Array.from(document.querySelectorAll('[data-viewport-top]')).pop()) {
					viewportTop.focus();
				} else {
					document.documentElement.classList.add('scroll-reset');
					document.body.scrollIntoView();
					setTimeout(() => {
						document.documentElement.classList.remove('scroll-reset');
					}, 600);
				}
			}, 0);
		}
		
		return response;
	});

	Observer.observe(session, changes => {
		//console.log('SESSION_STATE_CHANGE', changes[0].name, changes[0].value);
	});
	Observer.observe(workerClient, changes => {
		//console.log('SERVICE_WORKER_STATE_CHANGE', changes[0].name, changes[0].value);
	});
	Observer.observe(navigator, changes => {
		//console.log('NAVIGATORSTATE_CHANGE', changes[0].name, changes[0].value);
	});
};
