
/**
 * @imports
 */
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _toTitle from '@webqit/util/str/toTitle.js';
import _arrFrom from '@webqit/util/arr/from.js';
import { wwwFormUnserialize, wwwFormSet, wwwFormSerialize } from '../util.js';
import StdRequest from './StdRequest.js';
import { Observer } from './Runtime.js';
import Url from './Url.js';

/**
 * ---------------------------
 * The Client class
 * ---------------------------
 */

export default class Http {

	/**
	 * Constructs a new Http instance. Typically,
	 * 
	 * @param function 	client
	 * @param object 	params
	 *
	 * @return void
	 */
	static async createClient(client, params = {}) {

		/**
		 * ----------------
		 * instance
		 * ----------------
		 */
		const instance = {

			/**
			 * Performs a request.
			 *
			 * @param object|string 	href
			 * @param object 			options
			 *
			 * @return void
			 */
			async go(url, options = {}) {
				if (this.abortController) {
					this.abortController.abort();
				}
				this.abortController = new AbortController();
				let xRedirectCode = 300;
				// Generates request object
				let generateRequest = (url, options) => {
					return new StdRequest(url, {
						...options,
						headers: {
							'Accept': 'application/json',
							'X-Redirect-Policy': 'manual-when-cross-origin',
							'X-Redirect-Code': xRedirectCode,
							'X-Powered-By': '@webqit/webflo',
							...(options.headers || {}),
						},
						referrer: window.document.location.href,
						signal: this.abortController.signal,
					});
				};
				// Handles response object
				let handleResponse = (response) => {
					if (!response) return;
					if (response.redirected && this.isSameOrigin(response.url)) {
						Observer.set(this.location, { href: response.url }, {
							detail: { isRedirect: true },
						});
					} else if (response.headers.get('Location') && response.status === xRedirectCode) {
						window.location = response.headers.get('Location');
					}
				};
				url = typeof url === 'string' ? { href: url } : url;
				options = { referrer: this.location.href, ...options };
				Observer.set(this.location, url, { detail: options, });
				if (!(_before(url.href, '#') === _before(options.referrer, '#') && (options.method || 'GET').toUpperCase() === 'GET')) {
					handleResponse(await client.call(this, generateRequest(url.href, options)));
				}
			},

			/**
			 * Checks if an URL is same origin.
			 *
			 * @param object|string 	url
			 *
			 * @return Bool
			 */
			isSameOrigin(url) {
				if (typeof url === 'string') {
					let href = url;
					url = window.document.createElement('a');
					url.href = href
				}
				return !url.origin || url.origin === this.location.origin;
			},

			/**
			 * History object
			 */
			get history() {
				return window.history;
			}

		};

		// -----------------------
		// Initialize network
		Observer.set(instance, 'network', {});
		window.addEventListener('online', () => Observer.set(instance.network, 'online', navigator.onLine));
		window.addEventListener('offline', () => Observer.set(instance.network, 'online', navigator.onLine));

		// -----------------------
		// Initialize location
		Observer.set(instance, 'location', new Url(window.document.location));
		// -----------------------
		// Syndicate changes to the browser;s location bar
		Observer.observe(instance.location, [[ 'href' ]], ([e]) => {
			if (e.value === 'http:' || (e.detail || {}).src === window.document.location) {
				// Already from a "popstate" event as above, so don't push again
				return;
			}
			if (e.value === window.document.location.href || e.value + '/' === window.document.location.href) {
				instance.history.replaceState(instance.history.state, '', instance.location.href);
			} else {
				try { instance.history.pushState(instance.history.state, '', instance.location.href); } catch(e) {}
			}
		}, { diff: true });

		/**
		 * ----------------
		 * Navigation Interception
		 * ----------------
		 */

		// -----------------------
		// This event is triggered by
		// either the browser back button,
		// the window.history.back(),
		// the window.history.forward(),
		// or the window.history.go() action.
		window.addEventListener('popstate', e => {
			// Needed to allow window.document.location
			// to update to window.location
			let referrer = window.document.location.href;
			window.setTimeout(() => {
				instance.go(Url.copy(window.document.location), { referrer, src: window.document.location, srcType: 'history', });
			}, 0);
		});

		// -----------------------
		// Capture all link-clicks
		// and fire to this router.
		window.addEventListener('click', e => {
			var anchor = e.target.closest('a');
			if (!anchor || !anchor.href) return;
			if (!anchor.target && !anchor.download && (!anchor.origin || anchor.origin === instance.location.origin)) {
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
				// Publish everything, including hash
				instance.go(Url.copy(anchor), { src: anchor, srcType: 'link', });
				// URLs with # will cause a natural navigation
				// even if pointing to a different page, a natural navigation will still happen
				// because with the Observer.set() above, window.document.location.href would have become
				// the destination page, which makes it look like same page navigation
				if (!anchor.href.includes('#')) {
					e.preventDefault();
				}
			}
		});

		// -----------------------
		// Capture all form-submit
		// and fire to this router.
		window.addEventListener('submit', e => {
			var form = e.target.closest('form'), submitter = e.submitter;
			var submitParams = [ 'action', 'enctype', 'method', 'noValidate', 'target' ].reduce((params, prop) => {
				params[prop] = submitter && submitter.hasAttribute(`form${prop.toLowerCase()}`) ? submitter[`form${_toTitle(prop)}`] : form[prop];
				return params;
			}, {});
			// We support method hacking
			submitParams.method = (submitter && submitter.dataset.method) || form.dataset.method || submitParams.method;
			submitParams.submitter = submitter;
			// ---------------
			var actionEl = window.document.createElement('a');
			actionEl.href = submitParams.action;
			// ---------------
			// If not targeted and same origin...
			if (!submitParams.target && (!actionEl.origin || actionEl.origin === instance.location.origin)) {
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
				// Build data
				var formData = new FormData(form);
				if ((submitter || {}).name) {
					formData.set(submitter.name, submitter.value);
				}
				if (submitParams.method.toUpperCase() === 'GET') {
					var query = wwwFormUnserialize(actionEl.search);
					Array.from(formData.entries()).forEach(_entry => {
						wwwFormSet(query, _entry[0], _entry[1], false);
					});
					actionEl.search = wwwFormSerialize(query);
					formData = null;
				}
				instance.go(Url.copy(actionEl), { ...submitParams, body: formData, src: form, srcType: 'form', });
				// URLs with # will cause a natural navigation
				// even if pointing to a different page, a natural navigation will still happen
				// because with the Observer.set() above, window.document.location.href would have become
				// the destination page, which makes it look like same page navigation
				if (!actionEl.hash) {
					e.preventDefault();
				}
			}
		});

		// -----------------------
		// Startup route
		instance.go(window.document.location.href, { referrer: document.referrer });
		return instance;
	}

}