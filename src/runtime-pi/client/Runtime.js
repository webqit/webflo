
/**
 * @imports
 */
import { _before, _toTitle } from '@webqit/util/str/index.js';
import { Observer } from '@webqit/oohtml-ssr/apis.js';
import Storage from './Storage.js';
import Url from './Url.js';
import { wwwFormUnserialize, wwwFormSet, wwwFormSerialize } from '../util.js';
import * as whatwag from './whatwag.js';
import xURL from '../xURL.js';
import xFormData from "../xFormData.js";
import xRequestHeaders from "../xRequestHeaders.js";
import xResponseHeaders from "../xResponseHeaders.js";
import xRequest from "../xRequest.js";
import xResponse from "../xResponse.js";
import xfetch from '../xfetch.js';
import xHttpEvent from '../xHttpEvent.js';

const URL = xURL(whatwag.URL);
const FormData = xFormData(whatwag.FormData);
const ReadableStream = whatwag.ReadableStream;
const RequestHeaders = xRequestHeaders(whatwag.Headers);
const ResponseHeaders = xResponseHeaders(whatwag.Headers);
const Request = xRequest(whatwag.Request, RequestHeaders, FormData, whatwag.Blob);
const Response = xResponse(whatwag.Response, ResponseHeaders, FormData, whatwag.Blob);
const fetch = xfetch(whatwag.fetch);
const HttpEvent = xHttpEvent(Request, Response, URL);

export {
	URL,
	FormData,
	ReadableStream,
	RequestHeaders,
	ResponseHeaders,
	Request,
	Response,
	fetch,
	HttpEvent,
	Observer,
}

export default class Runtime {

    /**
     * Runtime
     * 
     * @param Object        cx
     * @param Function      clientCallback
     * 
     * @return void
     */
	constructor(cx, clientCallback) {

        // ---------------
		this.cx = cx;
        this.clients = new Map;
        // ---------------
		this.cx.runtime = this;
		let client = clientCallback(this.cx, '*');
        if (!client || !client.handle) throw new Error(`Application instance must define a ".handle()" method.`);
		this.clients.set('*', client);

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
				this.go(Url.copy(anchor), {}, { src: anchor, srcType: 'link', });
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
				this.go(Url.copy(actionEl), {
					method: submitParams.method,
					body: formData,
					headers: { contentType: submitParams.enctype },
				}, { ...submitParams, src: form, srcType: 'form', });
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
		// Initialize network
		Observer.set(this, 'network', {});
		window.addEventListener('online', () => Observer.set(this.network, 'online', navigator.onLine));
		window.addEventListener('offline', () => Observer.set(this.network, 'online', navigator.onLine));

        // ---------------
        this.go(this.location, {}, { srcType: 'init' });
        // ---------------
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
     * @param object 			init
     * @param object 			src
     *
     * @return Response
     */
    async go(url, init = {}, detail = {}) {
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        this._xRedirectCode = 200;
        // ------------
        url = typeof url === 'string' ? new whatwag.URL(url) : url;
        init = { referrer: this.location.href, ...init };
        // ------------
        if (detail.srcType !== 'init' && (_before(url.href, '#') === _before(init.referrer, '#') && (init.method || 'GET').toUpperCase() === 'GET')) {
			return;
        }
		// ------------
        if (['link', 'form'].includes(detail.srcType)) {
            Observer.set(detail.src, 'active', true);
            Observer.set(detail.submitter || {}, 'active', true);
        }
        // ------------
        Observer.set(this.location, url, { detail: { ...init, ...detail }, });
        Observer.set(this.network, 'redirecting', null);
        // ------------
		// The request object
		let request = this.generateRequest(url.href, init);
		// The navigation event
		let httpEvent = new HttpEvent(request, detail, (id = null, persistent = false) => this.getSession(httpEvent, id, persistent));
		// Response
		let response = await this.clients.get('*').handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
		let finalResponse = this.handleResponse(httpEvent, response);
        // Return value
		return finalResponse;
    }

	// Generates request object
	generateRequest(href, init) {
		return new Request(href, {
			signal: this._abortController.signal,
			...init,
			headers: {
				'Accept': 'application/json',
				'X-Redirect-Policy': 'manual-when-cross-origin',
				'X-Redirect-Code': this._xRedirectCode,
				'X-Powered-By': '@webqit/webflo',
				...(init.headers || {}),
			},
		});
	}

	// Generates session object
    getSession(e, id = null, persistent = false) {
		return Storage(id, persistent);
	}

	// Initiates remote fetch and sets the status
	remoteFetch(request, ...args) {
		Observer.set(this.network, 'remote', true);
		let _response = fetch(request, ...args);
		// This catch() is NOT intended to handle failure of the fetch
		_response.catch(e => Observer.set(this.network, 'error', e.message));
		// Return xResponse
		return _response.then(async response => {
			// Stop loading status
			Observer.set(this.network, 'remote', false);
			return new Response(response);
		});
	}

	// Handles response object
	handleResponse(e, response) {
		if (!(response instanceof Response)) { response = new Response(response); }
		Observer.set(this.network, 'remote', false);
		Observer.set(this.network, 'error', null);
		if (['link', 'form'].includes(e.detail.srcType)) {
			Observer.set(e.detail.src, 'active', false);
			Observer.set(e.detail.submitter || {}, 'active', false);
		}
		if (response.redirected && this.isSameOrigin(response.url)) {
			Observer.set(this.location, { href: response.url }, {
				detail: { isRedirect: true },
			});
		} else {
			let location = response.headers.get('Location');
			if (location && response.status === this._xRedirectCode) {
				Observer.set(this.network, 'redirecting', location);
				window.location = location;
			}
		}
		return response;
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