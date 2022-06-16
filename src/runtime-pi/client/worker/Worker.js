
/**
 * @imports
 */
import { _any } from '@webqit/util/arr/index.js';
import { HttpEvent, Request, Response, Observer } from '../Runtime.js';
import { urlPattern } from '../../util.js';

/**
 * ---------------------------
 * The Worker Initializer
 * ---------------------------
 */

export default class Worker {

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
        this.mockSessionStore = {};
        // ---------------
		this.cx.runtime = this;
		let client = clientCallback(this.cx, '*');
        if (!client || !client.handle) throw new Error(`Application instance must define a ".handle()" method.`);
		this.clients.set('*', client);
		
		// -------------
		// ONINSTALL
		self.addEventListener('install', evt => {
			if (this.cx.params.skip_waiting) { self.skipWaiting(); }
			// Manage CACHE
			if (this.cx.params.cache_name && (this.cx.params.cache_only_urls || []).length) {
				// Add files to cache
				evt.waitUntil( self.caches.open(this.cx.params.cache_name).then(cache => {
					if (this.cx.logger) { this.cx.logger.log('[ServiceWorker] Pre-caching resources.'); }
					const cache_only_urls = (this.cx.params.cache_only_urls || []).map(c => c.trim()).filter(c => c && !urlPattern(c, self.origin).isPattern());
					return cache.addAll(cache_only_urls);
				}) );
			}
		});

		// -------------
		// ONACTIVATE
		self.addEventListener('activate', evt => {
			evt.waitUntil( new Promise(async resolve => {
				if (this.cx.params.skip_waiting) { await self.clients.claim(); }
				// Manage CACHE
				if (this.cx.params.cache_name) {
					// Clear outdated CACHES
					await self.caches.keys().then(keyList => {
						return Promise.all(keyList.map(key => {
							if (key !== this.cx.params.cache_name && key !== this.cx.params.cache_name + '_json') {
								if (this.cx.logger) { this.cx.logger.log('[ServiceWorker] Removing old cache:', key); }
								return self.caches.delete(key);
							}
						}));
					}) 
				}
				resolve();
			}) );
		});

		// -------------
		// ONFETCH		
		self.addEventListener('fetch', event => {
			// URL schemes that might arrive here but not supported; e.g.: chrome-extension://
			if (!event.request.url.startsWith('http')) return;
			event.respondWith((async (req, evt) => {
				const requestInit = [
					'method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
				].reduce((init, prop) => ({ [prop]: req[prop], ...init }), {});
				if (!['GET', 'HEAD'].includes(req.method)) {
					requestInit.body = await req.text();
				}
				// Now, the following is key:
				// The browser likes to use "force-cache" for "navigate" requests, when, e.g: re-entering your site with the back button
				// Problem here, force-cache forces out JSON not HTML as per webflo's design.
				// So, we detect this scenerio and avoid it.
				if (req.cache === 'force-cache'/* && req.mode === 'navigate' - even webflo client init call also comes with that... needs investigation */) {
					requestInit.cache = 'default';
				}
				return this.go(req.url, requestInit, { event: evt });
			})(event.request, event));
		});

		// ---------------
        Observer.set(this, 'location', {});
        Observer.set(this, 'network', {});
        // ---------------
		Observer.observe(this.network, es => {
			//console.log('//////////', ...es.map(e => `${e.name}: ${e.value}`))
		});
		
	}

	/**
     * Performs a request.
     *
     * @param object|string 	url
     * @param object 			init
     * @param object 			detail
     *
     * @return Response
     */
	async go(url, init = {}, detail = {}) {
		// ------------
        url = typeof url === 'string' ? new URL(url) : url;
		init = { referrer: this.location.href, ...init };
        // ------------
		// The request object
		let request = await this.generateRequest(url.href, init);
		if (detail.event) {
			Object.defineProperty(detail.event, 'request', { value: request });
		}
		// The navigation event
		let httpEvent = new HttpEvent(request, detail, (id = null, persistent = false) => this.getSession(httpEvent, id, persistent));
		httpEvent.port.listen(message => {
			if (message.$type === 'handler:hints' && message.session) {
				// TODO: Sync session data from client
				return Promise.resolve();
			}
		});
		// Response
		let response;
		if (httpEvent.request.url.startsWith(self.origin)/* && httpEvent.request.mode === 'navigate'*/) {
			response = await this.clients.get('*').handle(httpEvent, ( ...args ) => this.remoteFetch( ...args ));
		} else {
			response = await this.remoteFetch(httpEvent.request);
		}
		let finalResponse = this.handleResponse(httpEvent, response);
        // Return value
        return finalResponse;
	}

    // Generates request object
    generateRequest(href, init) {
		let request = new Request(href, init);
		return request;
    }

    // Generates session object
    getSession(e, id = null, persistent = false) {
		return {
			get: () => this.mockSessionStore,
			set: value => { this.mockSessionStore = value },
		};
	}

	// Initiates remote fetch and sets the status
	remoteFetch(request, ...args) {
		if (arguments.length > 1) {
			request = this.generateRequest(request, ...args);
		}
		const matchUrl = (patterns, url) => _any((patterns || []).map(p => p.trim()).filter(p => p), p => urlPattern(p, self.origin).test(url));
		const execFetch = () => {
			if (matchUrl(this.cx.params.cache_only_urls, request.url)) {
				Observer.set(this.network, 'strategy', 'cache-only');
				return this.cacheFetch(request, { networkFallback: false, cacheRefresh: false });
			}
			// network_only_urls
			if (matchUrl(this.cx.params.network_only_urls, request.url)) {
				Observer.set(this.network, 'strategy', 'network-only');
				return this.networkFetch(request, { cacheFallback: false, cacheRefresh: false });
			}
			// cache_first_urls
			if (matchUrl(this.cx.params.cache_first_urls, request.url)) {
				Observer.set(this.network, 'strategy', 'cache-first');
				return this.cacheFetch(request, { networkFallback: true, cacheRefresh: true });
			}
			Observer.set(this.network, 'strategy', 'network-first');
			return this.networkFetch(request, { cacheFallback: true, cacheRefresh: true });
		};
		let response = execFetch(request);
		// This catch() is NOT intended to handle failure of the fetch
		response.catch(e => Observer.set(this.network, 'error', e.message));
		// Return xResponse
		return response.then(_response => Response.compat(_response));
	}

	// Caching strategy: cache_first
	cacheFetch(request, params = {}) {
		return this.getRequestCache(request).then(cache => cache.match(request).then(response => {
			// Nothing cache, use network
			if (!response && params.networkFallback) return this.networkFetch(request, { ...params, cacheFallback: false });
			// Note: fetch, but for refreshing purposes only... not the returned response
			if (response && params.cacheRefresh) this.networkFetch(request, { ...params, justRefreshing: true });
			Observer.set(this.network, 'cache', true);
			return response;
		}));
	}

	// Caching strategy: network_first
	networkFetch(request, params = {}) {
		if (!params.cacheFallback) {
			Observer.set(this.network, 'remote', true);
			return self.fetch(request);
		}
		return self.fetch(request).then(response => {
			if (params.cacheRefresh) this.refreshCache(request, response);
			Observer.set(this.network, 'remote', true);
			return response;
		}).catch(() => this.getRequestCache(request).then(cache => {
			Observer.set(this.network, 'cache', true);
			return cache.match(request);
		}));
	}

	// Caches response 
	refreshCache(request, response) {
		// Check if we received a valid response
		if (request.method !== 'GET' || !response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
			return response;
		}
		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();
		this.getRequestCache(request).then(cache => {
			Observer.set(this.network, 'cacheRefresh', true);
			cache.put(request, responseToCache);
		});
		return response;
	}

	// Returns either the regular cache or a json-specific cache
	getRequestCache(request) {
		let cacheName = request.headers.get('Accept') === 'application/json'
			? this.cx.params.cache_name + '_json' 
			: this.cx.params.cache_name;
		return self.caches.open(cacheName);
	}

	// Handles response object
	handleResponse(e, response) {
		if (!(response instanceof Response)) { response = Response.compat(response); }
		return response;
	}

}