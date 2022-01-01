
/**
 * @imports
 */
import { Observer } from '@webqit/pseudo-browser/index2.js';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _toTitle from '@webqit/util/str/toTitle.js';
import _arrFrom from '@webqit/util/arr/from.js';
import { wwwFormUnserialize, wwwFormSet, wwwFormSerialize } from '../util.js';
import StdRequest from './StdRequest.js';
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
			 * @param string 	href
			 * @param object 	request
			 * @param object 	src
			 *
			 * @return UserEvent
			 */
			go(href, request = {}, src = null) {
				return Observer.set(this.location, 'href', href, {
					detail: {request, src,},
				});
			}
		};

		/**
		 * ----------------
		 * instance.location
		 * ----------------
		 */
		Observer.set(instance, 'location', new Url(window.document.location));
		// -----------------------
		// This event is triggered by
		// either the browser back button,
		// the window.history.back(),
		// the window.history.forward(),
		// or the window.history.go() action.
		window.addEventListener('popstate', e => {
			// Needed to allow window.document.location
			// to update to window.location
			window.setTimeout(() => {
				Observer.set(instance.location, Url.copy(window.document.location), {
					detail: { type: 'history', src: window.document.location },
				});
			}, 0);
		});

		// -----------------------
		// Capture all link-clicks
		// and fire to this router.
		window.addEventListener('click', e => {
			var anchor, href;
			if ((anchor = e.target.closest('a')) && (href = anchor.href)
			// And not towards any target nor have a download directive
			&& !anchor.target && !anchor.download
			// Same origin... but...
			&& (!anchor.origin || anchor.origin === instance.location.origin)) {
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
					return;
				}
				// Publish everything, including hash
				Observer.set(instance.location, Url.copy(anchor), {
					detail: { type: 'link', src: anchor, },
				});
				// URLs with # will cause a natural navigation
				// even if pointing to a different page, a natural navigation will still happen
				// because with the Observer.set() above, window.document.location.href would have become
				// the destination page, which makes it look like same page navigation
				if (!href.includes('#')) {
					e.preventDefault();
				}
			}
		});

		// -----------------------
		// Capture all form-submit
		// and fire to this router.
		window.addEventListener('submit', e => {
			var actionEl = window.document.createElement('a'),
				form = e.target.closest('form'),
				submits = [e.submitter]; //_arrFrom(form.elements).filter(el => el.matches('button,input[type="submit"],input[type="image"]'));
			var submitParams = [ 'action', 'enctype', 'method', 'noValidate', 'target' ].reduce((params, prop) => {
				params[prop] = submits.reduce((val, el) => val || (el.hasAttribute(`form${prop.toLowerCase()}`) ? el[`form${_toTitle(prop)}`] : null), null) || form[prop];
				return params;
			}, {});
			// We support method hacking
			// ---------------
			submitParams.method = e.submitter.dataset.method || form.dataset.method || submitParams.method;
			// ---------------
			if ((actionEl.href = submitParams.action) && !submitParams.target
			// Same origin... but...
			&& (!actionEl.origin || actionEl.origin === instance.location.origin)) {
				var formData = new FormData(form);
				if (e.submitter.name) {
					formData.set(e.submitter.name, e.submitter.value);
				}
				if (submitParams.method === 'get') {
					var query = wwwFormUnserialize(actionEl.search);
					Array.from(formData.entries()).forEach(_entry => {
						wwwFormSet(query, _entry[0], _entry[1], false);
					});
					actionEl.search = wwwFormSerialize(query);
					formData = null;
				}
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
					return;
				}
				// Publish everything, including hash
				Observer.set(instance.location, Url.copy(actionEl), {
					detail: { type: 'form', src: form, submitParams, data: formData },
				});
				// URLs with # will cause a natural navigation
				// even if pointing to a different page, a natural navigation will still happen
				// because with the Observer.set() above, window.document.location.href would have become
				// the destination page, which makes it look like same page navigation
				if (!actionEl.hash) {
					e.preventDefault();
				}
			}
		});

		/**
		 * ----------------
		 * instance.history
		 * ----------------
		 */

		instance.history = window.history;
		// -----------------------
		// Syndicate changes to
		// the browser;s location bar
		Observer.observe(instance.location, [[ 'href' ]], e => {
			e = e[0];
			if ((e.detail || {}).src === window.document.location) {
				// Already from a "popstate" event as above, so don't push again
				return;
			}
			if (e.value === 'http:') return;
			if (e.value === window.document.location.href || e.value + '/' === window.document.location.href) {
				instance.history.replaceState(instance.history.state, '', instance.location.href);
			} else {
				try {
					instance.history.pushState(instance.history.state, '', instance.location.href);
				} catch(e) {}
			}
		}, { diff: true });

		// ----------------------------------
		const createRequest = (url, referrer, e = {}) => {
			var detail = e.detail || {};
			var options = {
				method: (detail.submitParams || detail.src || {}).method || 'get',
				body: detail.data,
				headers: { ...(detail.headers || {}), 'X-Powered-By': '@webqit/webflo', },
				referrer,
			};
			return new StdRequest(url, options);
		};
		const handleResponse = response => {
			if (response && response.redirected) {
				var actionEl = window.document.createElement('a');
				if ((actionEl.href = response.url) && (!actionEl.origin || actionEl.origin === instance.location.origin)) {
					Observer.set(instance.location, { href: response.url }, {
						detail: { follow: false },
					});
				}
			}
		};
		// ----------------------------------

		// Observe location and route
		Observer.observe(instance.location, [['href']], async e => {
			e = e[0];
			var detail = e.detail || {};
			if (detail.follow === false) return;
			var method = (detail.submitParams || detail.src || {}).method;
			if ((_before(e.value, '#') !== _before(e.oldValue, '#')) || (method && method.toUpperCase() !== 'GET')) {
				return handleResponse(await client.call(instance, createRequest(e.value, e.oldValue, e), e));
			}
		}, {diff: false /* method might be the difference */});
		// Startup route
		handleResponse(await client.call(instance, createRequest(window.document.location.href, document.referrer)));

		return instance;
	}

}