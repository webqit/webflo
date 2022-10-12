
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
import Workport from './Workport.js';

const URL = xURL(whatwag.URL);
const FormData = xFormData(whatwag.FormData);
const ReadableStream = whatwag.ReadableStream;
const RequestHeaders = xRequestHeaders(whatwag.Headers);
const ResponseHeaders = xResponseHeaders(whatwag.Headers);
const Request = xRequest(whatwag.Request, RequestHeaders, FormData, whatwag.Blob);
const Response = xResponse(whatwag.Response, ResponseHeaders, FormData, whatwag.Blob);
const fetch = xfetch(whatwag.fetch, Request);
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
				this.go(Url.copy(window.document.location), {}, { src: window.document.location, srcType: 'history', });
			}, 0);
		});

		// -----------------------
		// Capture all link-clicks
		// and fire to this router.
		window.addEventListener('click', e => {
			var anchorEl = e.target.closest('a');
			if (!anchorEl || !anchorEl.href) return;
			if (!anchorEl.target && !anchorEl.download && this.isSpaRoute(anchorEl, e)) {
				// Publish everything, including hash
				this.go(Url.copy(anchorEl), {}, { src: anchorEl, srcType: 'link', });
				if (!this.isHashAction(anchorEl)) {
					e.preventDefault();
				}
			}
		});

		// -----------------------
		// Capture all form-submit
		// and fire to this router.
		window.addEventListener('submit', e => {
			const form = e.target.closest('form'), submitter = e.submitter;
			const submitParams = [ 'action', 'enctype', 'method', 'noValidate', 'target' ].reduce((params, prop) => {
				params[prop] = submitter && submitter.hasAttribute(`form${prop.toLowerCase()}`) ? submitter[`form${_toTitle(prop)}`] : form[prop];
				return params;
			}, {});
			// We support method hacking
			submitParams.method = (submitter && submitter.dataset.formmethod) || form.dataset.method || submitParams.method;
			submitParams.submitter = submitter;
			// ---------------
			var actionEl = window.document.createElement('a');
			actionEl.href = submitParams.action;
			// ---------------
			// If not targeted and same origin...
			if (!submitParams.target && this.isSpaRoute(actionEl, e)) {
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
				}, { ...submitParams, src: form, srcType: 'form', });
				if (!this.isHashAction(actionEl)) {
					e.preventDefault();
				}
			}
		});

		// -----------------------
		// Initialize network
		Observer.set(this, 'network', {});
		window.addEventListener('online', () => Observer.set(this.network, 'connectivity', 'online'));
		window.addEventListener('offline', () => Observer.set(this.network, 'connectivity', 'offline'));

		// -----------------------
		// Service Worker && COMM
		if (this.cx.params.service_worker_support) {
			let workport = new Workport(this.cx.params.worker_filename, { scope: this.cx.params.worker_scope, startMessages: true });
			Observer.set(this, 'workport', workport);
			workport.messaging.listen(async evt => {
				let responsePort = evt.ports[0];
				let client = this.clients.get('*');
				let response = client.alert && await client.alert(evt);
				if (responsePort) {
					if (response instanceof Promise) {
						response.then(data => {
							responsePort.postMessage(data);
						});
					} else {
						responsePort.postMessage(response);
					}
				}
			});
		}

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

	// Check is-hash-action
	isHashAction(urlObj) {
		const isHashNav = _before(window.document.location.href, '#') === _before(urlObj.href, '#') && urlObj.href.includes('#');
		return isHashNav// && urlObj.hash.length > 1 && document.querySelector(urlObj.hash);
	}

	// Check is-spa-route
	isSpaRoute(url, e = undefined) {
		url = typeof url === 'string' ? new whatwag.URL(url) : url;
		if (url.origin && url.origin !== this.location.origin) return false;
		if (e && (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)) return false;
		if (!this.cx.params.routing) return true;
		if (this.cx.params.routing.targets === false/** explicit false means disabled */) return false;
		let b = url.pathname.split('/').filter(s => s);
		const match = a => {
			a = a.split('/').filter(s => s);
			return a.reduce((prev, s, i) => prev && (s === b[i] || [s, b[i]].includes('-')), true);
		};
		return match(this.cx.params.routing.root) && this.cx.params.routing.subroots.reduce((prev, subroot) => {
			return prev && !match(subroot);
		}, true);
	}

	// Generates request object
	generateRequest(href, init) {
		return new Request(href, {
			signal: this._abortController.signal,
			...init,
			headers: {
				'Accept': 'application/json',
				'X-Redirect-Policy': 'manual-when-cross-spa',
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
        url = typeof url === 'string' ? new whatwag.URL(url) : url;
        init = { referrer: this.location.href, ...init };
        // ------------
		// Put his forward before instantiating a request and aborting previous
		// Same-page hash-links clicks on chrome recurse here from histroy popstate
        if (detail.srcType !== 'init' && (_before(url.href, '#') === _before(init.referrer, '#') && (init.method || 'GET').toUpperCase() === 'GET')) {
			return new Response(null, { status: 304 }); // Not Modified
        }
		// ------------
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        this._xRedirectCode = 200;
        // ------------
		// States
		// ------------
        Observer.set(this.network, 'error', null);
        Observer.set(this.network, 'requesting', { ...init, ...detail });
        if (['link', 'form'].includes(detail.srcType)) {
            detail.src.state && (detail.src.state.active = true);
            detail.submitter && detail.submitter.state && (detail.submitter.state.active = true);
        }
        // ------------
		// Run
		// ------------
		// The request object
		let request = this.generateRequest(url.href, init);
		// The navigation event
		let httpEvent = new HttpEvent(request, detail, (id = null, persistent = false) => this.getSession(httpEvent, id, persistent));
		// Response
		let client = this.clients.get('*'), response, finalResponse;
		try {
			// ------------
			// Response
			// ------------
			response = await client.handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
			finalResponse = this.handleResponse(httpEvent, response);
			// ------------
			// Address bar
			// ------------
			if (response.redirected) {
				Observer.set(this.location, { href: response.url }, { detail: { redirected: true }, });
				Observer.set(this.network, 'requesting', null);
			} else if (![302, 301].includes(finalResponse.status)) {
				Observer.set(this.location, Url.copy(url)/* copy() is important */);
				Observer.set(this.network, 'requesting', null);
			}
			// ------------
			// States
			// ------------
			if (['link', 'form'].includes(detail.srcType)) {
				detail.src.state && (detail.src.state.active = false);
            	detail.submitter && detail.submitter.state && (detail.submitter.state.active = false);
			}
			// ------------
			// Rendering
			// ------------
			if (finalResponse.ok && (finalResponse.headers.contentType === 'application/json' || finalResponse.headers.contentType.startsWith('multipart/form-data'))) {
				client.render && await client.render(httpEvent, finalResponse);
			} else if (!finalResponse.ok) {
				if ([404, 500].includes(finalResponse.status)) {
					Observer.set(this.network, 'error', new Error(finalResponse.statusText, { cause: finalResponse.status }));
				}
				client.unrender && await client.unrender(httpEvent);
			}
		} catch(e) {
			console.error(e);
			Observer.set(this.network, 'error', { ...e, retry: () => this.go(url, init = {}, detail) });
			finalResponse = new Response(null, { status: 500, statusText: e.message });
		}
		// ------------
        // Return value
		return finalResponse;
    }

	// Initiates remote fetch and sets the status
	async remoteFetch(request, ...args) {
		let href = request;
		if (request instanceof Request) {
			href = request.url;
		} else if (request instanceof self.URL) {
			href = request.href;
		}
		Observer.set(this.network, 'remote', href);
		let _response = fetch(request, ...args);
		// This catch() is NOT intended to handle failure of the fetch
		_response.catch(e => Observer.set(this.network, 'error', e));
		// Return xResponse
		return _response.then(async response => {
			// Stop loading status
			Observer.set(this.network, 'remote', null);
			return new Response(response);
		});
	}

	// Handles response object
	handleResponse(e, response) {
		if (!(response instanceof Response)) { response = new Response(response); }
		if (!response.redirected) {
			let location = response.headers.get('Location');
			if (location) {
				let xActualRedirectCode = parseInt(response.headers.get('X-Redirect-Code'));
				if (xActualRedirectCode && response.status === this._xRedirectCode) {
					response.attrs.status = xActualRedirectCode;
					Observer.set(this.network, 'redirecting', location);
					window.location = location;
				} else if ([302,301].includes(response.status)) {
					if (!this.isSpaRoute(location)) {
						Observer.set(this.network, 'redirecting', location);
						window.location = location;
					} else {
						this.go(location, {}, { srcType: 'rdr' });
					}
				}
			}
		}
		return response;
	}

}