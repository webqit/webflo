
/**
 * @imports
 */
import _isGlobe from 'is-glob';
import Minimatch from 'minimatch';
import { _any } from '@webqit/util/arr/index.js';
import { _after, _afterLast } from '@webqit/util/str/index.js';
import { HttpEvent, Request, Response } from '../Runtime.js';
import { Observer } from '../Runtime.js';

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
					const cache_only_urls = (this.cx.params.cache_only_urls || []).map(c => c.trim()).filter(c => c);
					return cache.addAll(cache_only_urls.filter(url => !_isGlobe(url) && !_afterLast(url, '.').includes('/')));
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
		self.addEventListener('fetch', async evt => {
			// URL schemes that might arrive here but not supported; e.g.: chrome-extension://
			if (!evt.request.url.startsWith('http') || evt.request.mode === 'navigate') return;
			const requestInit = [
				'method', 'headers', 'body', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
			].reduce((init, prop) => ({ [prop]: evt.request[prop], ...init }), {});
			evt.respondWith(this.go(evt.request.url, requestInit, { event: evt }));
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
		let request = this.generateRequest(url.href, init);
		if (detail.event instanceof self.Request) {
			request = detail.event.request;
			//Object.defineProperty(detail.event, 'request', { value: request });
		}
		// The navigation event
		let httpEvent = new HttpEvent(request, detail, (id = null, persistent = false) => this.getSession(httpEvent, id, persistent));
		httpEvent.port.listen(message => {
			if (message.$type === 'handler:hints' && message.session) {
				// TODO: Sync sesseion data from client
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
		// Now, the following is key:
		// The browser likes to use "force-cache" for "navigate" requests
		// when, for example, the back button was used.
		// Thus the origin server would still not be contacted by the self.fetch() below, leading to inconsistencies in responses.
		// So, we detect this scenerio and avoid it.
		if (init.mode === 'navigate' && init.cache === 'force-cache') {
			init = { ...init, cache: 'default' };
		}
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
		const execFetch = () => {
			if (_any((this.cx.params.cache_only_urls || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(request.url, pattern))) {
				Observer.set(this.network, 'strategy', 'cache-only');
				return this.cacheFetch(request, { networkFallback: false, cacheRefresh: false });
			}
			// network_only_urls
			if (_any((this.cx.params.network_only_urls || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(request.url, pattern))) {
				Observer.set(this.network, 'strategy', 'network-only');
				return this.networkFetch(request, { cacheFallback: false, cacheRefresh: false });
			}
			// cache_first_urls
			if (_any((this.cx.params.cache_first_urls || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(request.url, pattern))) {
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
		return response.then(_response => new Response(_response));
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
		if (params.forceNetwork) {
			let url = new URL(request.url);
			url.searchParams.set('$force-cache', '1');
			request.attr.url = url.toString();
		}
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
		if (!(response instanceof Response)) { response = new Response(response); }
		return response;
	}

}