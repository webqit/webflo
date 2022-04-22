
/**
 * @imports
 */
import _before from '@webqit/util/str/before.js';
import _toTitle from '@webqit/util/str/toTitle.js';
import { wwwFormUnserialize, wwwFormSet, wwwFormSerialize } from '../util.js';
import { Observer } from './Runtime.js';
import Url from './Url.js';

export default class Navigator {

    constructor(client) {
        this.client = client;

		/**
		 * ----------------
		 * Navigator location
		 * ----------------
		 */

		// -----------------------
		// Initialize location
		Observer.set(this, 'location', new Url(window.document.location));
		// -----------------------
		// Syndicate changes to the browser;s location bar
		Observer.observe(this.location, [[ 'href' ]], ([e]) => {
			if (e.value === 'http:' || (e.detail || {}).src === window.document.location) {
				// Already from a "popstate" event as above, so don't push again
				return;
			}
			if (e.value === window.document.location.href || e.value + '/' === window.document.location.href) {
				window.history.replaceState(window.history.state, '', this.location.href);
			} else {
				try { window.history.pushState(window.history.state, '', this.location.href); } catch(e) {}
			}
		}, { diff: true });

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
				this.go(Url.copy(window.document.location), { src: window.document.location, srcType: 'history', });
			}, 0);
		});

		// -----------------------
		// Capture all link-clicks
		// and fire to this router.
		window.addEventListener('click', e => {
			var anchor = e.target.closest('a');
			if (!anchor || !anchor.href) return;
			if (!anchor.target && !anchor.download && (!anchor.origin || anchor.origin === this.location.origin)) {
				if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
				// Publish everything, including hash
				this.go(Url.copy(anchor), { src: anchor, srcType: 'link', });
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
			if (!submitParams.target && (!actionEl.origin || actionEl.origin === this.location.origin)) {
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
				this.go(Url.copy(actionEl), { ...submitParams, body: formData, src: form, srcType: 'form', });
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
		 * Navigator network
		 * ----------------
		 */

		// -----------------------
		// Initialize network
		Observer.set(this, 'network', {});
		window.addEventListener('online', () => Observer.set(this.network, 'online', navigator.onLine));
		window.addEventListener('offline', () => Observer.set(this.network, 'online', navigator.onLine));

		/**
		 * ----------------
		 * Initial navigation
		 * ----------------
		 */

        this.go(this.location, { srcType: 'init' });
     }

    /**
     * History object
     */
    get history() {
        return window.history;
    }

    /**
     * Performs a request.
     *
     * @param object|string 	href
     * @param object 			params
     *
     * @return void
     */
    async go(url, params = {}) {

        // Generates request object
        const generateRequest = (url, params) => {
            return new Request(url, {
                ...params,
                headers: {
                    'Accept': 'application/json',
					'Cache-Control': 'no-store',
                    'X-Redirect-Policy': 'manual-when-cross-origin',
                    'X-Redirect-Code': xRedirectCode,
                    'X-Powered-By': '@webqit/webflo',
                    ...(params.headers || {}),
                },
                referrer: window.document.location.href,
                signal: this._abortController.signal,
            });
        };

        // Initiates remote fetch and sets the status
        const remoteRequest = request => {
            Observer.set(this.network, 'remote', true);
            let _response = fetch(request);
            // This catch() is NOT intended to handle failure of the fetch
            _response.catch(e => Observer.set(this.network, 'error', e.message));
            // Save a reference to this
            return _response.then(async response => {
                // Stop loading status
                Observer.set(this.network, 'remote', false);
                return response;
            });
        };

        // Handles response object
        const handleResponse = async (response, params) => {
            response = await response;
            Observer.set(this.network, 'remote', false);
            Observer.set(this.network, 'error', null);
            if (['link', 'form'].includes(params.srcType)) {
                Observer.set(params.src, 'active', false);
                Observer.set(params.submitter || {}, 'active', false);
            }
            if (!response) return;
            if (response.redirected && this.isSameOrigin(response.url)) {
                Observer.set(this.location, { href: response.url }, {
                    detail: { isRedirect: true },
                });
                return;
            }
            let location = response.headers.get('Location');
            if (location && response.status === xRedirectCode) {
                Observer.set(this.network, 'redirecting', location);
                window.location = location;
            }
        };

        // ------------
        url = typeof url === 'string' ? { href: url } : url;
        params = { referrer: this.location.href, ...params };
        // ------------
        Observer.set(this.location, url, { detail: params, });
        Observer.set(this.network, 'redirecting', null);
        // ------------
        if (['link', 'form'].includes(params.srcType)) {
            Observer.set(params.src, 'active', true);
            Observer.set(params.submitter || {}, 'active', true);
        }
        // ------------

        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        let xRedirectCode = 300;

        if (params.srcType === 'init' || !(_before(url.href, '#') === _before(params.referrer, '#') && (params.method || 'GET').toUpperCase() === 'GET')) {
            handleResponse(this.client.call(this, generateRequest(url.href, params), params, remoteRequest), params);
        }

        return this._abortController;
    }

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
    }

}