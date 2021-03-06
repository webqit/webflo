
/**
 * @imports
 */
import { Observer } from '@webqit/pseudo-browser/index2.js';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _toTitle from '@webqit/util/str/toTitle.js';
import _arrFrom from '@webqit/util/arr/from.js';
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
	static createClient(client, params = {}) {

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
		Observer.set(instance, 'location', new Url(window.document.location, params.path_naming_scheme));
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
					detail: {type: 'history', src: window.document.location},
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
					detail: {type: 'link', src: anchor,},
				});
				// Only on "href" change or on same "href" but no "hash"
				// In other words, same "href" "hash"-based navigation should be natural
				if (!href.includes('#') || _before(href, '#') !== _before(window.document.location.href, '#')) {
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
				submits = _arrFrom(form.elements).filter(el => el.matches('button,input[type="submit"],input[type="image"]'));
			var submitParams = ['action', 'enctype', 'method', 'noValidate', 'target'].reduce((params, prop) => {
				params[prop] = submits.reduce((val, el) => val || (el.hasAttribute(`form${prop.toLowerCase()}`) ? el[`form${_toTitle(prop)}`] : null), null) || form[prop];
				return params;
			}, {});
			if ((actionEl.href = submitParams.action) && !submitParams.target
			// Same origin... but...
			&& (!actionEl.origin || actionEl.origin === instance.location.origin)) {
				var formData = new FormData(form);
				if (submitParams.method === 'get') {
					var query = (new URLSearchParams(formData.entries())).toString();
					actionEl.search += `${actionEl.search ? '&' : '?'}${query}`;
					formData = null;
				}
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
					return;
				}
				// Publish everything, including hash
				Observer.set(instance.location, Url.copy(actionEl), {
					detail: {type: 'form', src: form, submitParams, data: formData},
				});
				// Only on "href" change or on same "href" but no "hash"
				// In other words, same "href" "hash"-based navigation should be natural
				if (!actionEl.hash || _before(actionEl.href, '#') !== _before(window.document.location.href, '#')) {
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
		Observer.observe(instance.location, [['href']], e => {
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
		}, {diff: true});

		// ----------------------------------
		const createRequest = (url, referrer, e = {}) => {
			var detail = e.detail || {};
			var options = {
				method: (detail.submitParams || detail.src || {}).method || 'get',
				body: detail.data,
				headers: { 'X-Powered-By': '@webqit/webflo', },
				referrer,
			};
			if (detail.accept) {
				options.headers.accept = detail.accept;
			}
			if (typeof Request !== 'undefined') {
				return new Request(url, options);
			}
			return {url, ...options};
		};
		// ----------------------------------

		// Observe location and route
		Observer.observe(instance.location, [['href']], async e => {
			e = e[0];
			var detail = e.detail || {};
			var method = (detail.submitParams || detail.src || {}).method;
			if ((_before(e.value, '#') !== _before(e.oldValue, '#')) || (method && method.toUpperCase() !== 'GET')) {
				return await client.call(instance, createRequest(e.value, e.oldValue, e), e);
			}
		}, {diff: false /* method might be the difference */});
		// Startup route
		client.call(instance, createRequest(window.document.location.href, document.referrer));

		return instance;
	}

}