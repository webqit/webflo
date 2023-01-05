
/**
 * @imports
 */
import { _before, _toTitle } from '@webqit/util/str/index.js';
import { Observer } from '@webqit/oohtml-ssr/apis.js';
import createStorage from './createStorage.js';
import Url from './Url.js';
import Workport from './Workport.js';
import xRequest from "../xRequest.js";
import xResponse from "../xResponse.js";
import xfetch from '../xfetch.js';
import HttpEvent from '../HttpEvent.js';
import _Runtime from '../Runtime.js';
import { params } from '../util-url.js';

export {
	HttpEvent,
	Observer,
}

export default class Runtime extends _Runtime {

    /**
     * Runtime
     * 
     * @param Object        cx
     * @param Function      applicationInstance
     * 
     * @return void
     */
	constructor(cx, applicationInstance) {
		super(cx, applicationInstance);
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
					var query = params.parse(actionEl.search);
					Array.from(formData.entries()).forEach(_entry => {
						params.set(query, _entry[0], _entry[1]);
					});
					actionEl.search = params.stringify(query);
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
			const { public_base_url: base, worker_filename: filename, worker_scope: scope } = this.cx.params;
			const workport = new Workport(base + filename, { scope, startMessages: true });
			Observer.set(this, 'workport', workport);
		}

		// -----------------------
		// Initialize and Hydration
		(async () => {
			let shouldHydrate;
			if (this.app.init) {
				const request = this.generateRequest(this.location);
				const httpEvent = new HttpEvent(request, { srcType: 'initialization' }, (id = null, persistent = false) => this.getSession(httpEvent, id, persistent));
				shouldHydrate = await this.app.init(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
			}
			if (shouldHydrate !== false) {
				this.go(this.location, {}, { srcType: 'hydration' });
			}
		})(); 

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
		url = typeof url === 'string' ? new URL(url, this.location.origin) : url;
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
	generateRequest(href, init = {}) {
		return new xRequest(href, {
			signal: this._abortController && this._abortController.signal,
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
    createStorage(e, id = null, persistent = false) {
		return createStorage(id, persistent);
	}

    /**
     * Performs a request.
     *
     * @param object|string 	href
     * @param object|Request 	init
     * @param object 			src
     *
     * @return Response
     */
    async go(url, init = {}, detail = {}) {
        url = typeof url === 'string' ? new URL(url, this.location.origin) : url;
		if (!(init instanceof Request) && !init.referrer) {
			init = { referrer: this.location.href, ...init };
		}
        // ------------
		// Put his forward before instantiating a request and aborting previous
		// Same-page hash-links clicks on chrome recurse here from histroy popstate
        if (![ 'hydration', 'rdr' ].includes(detail.srcType) && (_before(url.href, '#') === _before(init.referrer, '#') && (init.method || 'GET').toUpperCase() === 'GET')) {
			return new xResponse(null, { status: 304 }); // Not Modified
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
        Observer.set(this.network, 'requesting', { init, ...detail });
        if (['link', 'form'].includes(detail.srcType)) {
            detail.src.state && (detail.src.state.active = true);
            detail.submitter && detail.submitter.state && (detail.submitter.state.active = true);
        }
        // ------------
		// Run
		// ------------
		const request = this.generateRequest(url.href, init);
		const httpEvent = new HttpEvent(request, detail, (id = null, persistent = false) => this.createStorage(httpEvent, id, persistent));
		let response, finalResponse;
		try {
			// ------------
			// Response
			// ------------
			response = await this.app.handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
			finalResponse = this.handleResponse(httpEvent, response);
			// ------------
			// Address bar
			// ------------
			if (response && response.redirected) {
				Observer.set(this.location, { href: response.url }, { detail: { redirected: true, ...detail }, });
			} else if (![302, 301].includes(finalResponse.status)) {
				Observer.set(this.location, Url.copy(url)/* copy() is important */, { detail });
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
				this.app.render && await this.app.render(httpEvent, finalResponse);
			} else if (!finalResponse.ok) {
				if ([404, 500].includes(finalResponse.status)) {
					Observer.set(this.network, 'error', new Error(finalResponse.statusText, { cause: finalResponse.status }));
				}
				if (!finalResponse.headers.get('Location')) {
					this.app.unrender && await this.app.unrender(httpEvent);
				}
			}
		} catch(e) {
			console.error(e);
			Observer.set(this.network, 'error', { ...e, retry: () => this.go(url, init = {}, detail) });
			finalResponse = new xResponse(null, { status: 500, statusText: e.message });
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
		} else if (request instanceof URL) {
			href = request.href;
		}
		Observer.set(this.network, 'remote', href);
		let _response = xfetch(request, ...args);
		// This catch() is NOT intended to handle failure of the fetch
		_response.catch(e => Observer.set(this.network, 'error', e));
		// Return xResponse
		return _response.then(async response => {
			// Stop loading status
			Observer.set(this.network, 'remote', null);
			return new xResponse(response);
		});
	}

	// Handles response object
	handleResponse(e, response) {
		if (typeof response === 'undefined') { response = new xResponse(undefined, { status: 404 }); }
		else if (!(response instanceof xResponse)) { response = new xResponse(response); }
		Observer.set(this.network, 'requesting', null);
		Observer.set(this.network, 'redirecting', null);
		if (!response.redirected) {
			let location = response.headers.get('Location');
			if (location) {
				let xActualRedirectCode = parseInt(response.headers.get('X-Redirect-Code'));
				Observer.set(this.network, 'redirecting', location);
				if (xActualRedirectCode && response.status === this._xRedirectCode) {
					response.attrs.status = xActualRedirectCode;
					window.location = location;
				} else if ([302,301].includes(response.status)) {
					if (!this.isSpaRoute(location)) {
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