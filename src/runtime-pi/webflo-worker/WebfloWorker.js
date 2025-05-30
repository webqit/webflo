import { _any } from '@webqit/util/arr/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { Context } from './Context.js';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { ClientMessagingPort } from './ClientMessagingPort.js';
import { WorkerSideCookies } from './WorkerSideCookies.js';
import { WorkerSideWorkport } from './WorkerSideWorkport.js';
import { ClientSideRouter } from '../webflo-client/ClientSideRouter.js';
import { HttpSession } from '../webflo-routing/HttpSession.js';
import { HttpEvent } from '../webflo-routing/HttpEvent.js';
import { HttpUser } from '../webflo-routing/HttpUser.js';
import '../webflo-fetch/index.js';
import '../webflo-url/index.js';

export class WebfloWorker extends WebfloRuntime {

	static get Context() { return Context; }

	static get Router() { return ClientSideRouter; }

	static get HttpEvent() { return HttpEvent; }

	static get HttpCookies() { return WorkerSideCookies; }

	static get HttpSession() { return HttpSession; }

	static get HttpUser() { return HttpUser; }

	static get Workport() { return WorkerSideWorkport; }

	static create(cx) {
		return new this(this.Context.create(cx));
	}

	#cx;
	get cx() { return this.#cx; }

    #sdk = {};
    get sdk() { return this.#sdk; }

	constructor(cx) {
		super();
		if (!(cx instanceof this.constructor.Context)) {
			throw new Error('Argument #1 must be a Webflo Context instance');
		}
		this.#cx = cx;
	}

	async initialize() {
		const instanceController = super.initialize();
		// ONINSTALL
		const installHandler = (event) => {
			if (this.cx.params.skip_waiting) self.skipWaiting();
			// Manage CACHE
			if (this.cx.params.cache_name && (this.cx.params.cache_only_urls || []).length) {
				// Add files to cache
				event.waitUntil(self.caches.open(this.cx.params.cache_name).then(async cache => {
					if (this.cx.logger) { this.cx.logger.log('[ServiceWorker] Pre-caching resources.'); }
					for (const urls of ['cache_first_urls', 'cache_only_urls']) {
						const _urls = (this.cx.params[urls] || []).map(c => c.trim()).filter(c => c && !(new URLPattern(c, self.origin)).isPattern());
						await cache.addAll(_urls);
					}
				}));
			}
		};
		// ONACTIVATE
		const activateHandler = (event) => {
			event.waitUntil(new Promise(async resolve => {
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
			}));
		};
		self.addEventListener('install', installHandler, { signal: instanceController.signal });
		self.addEventListener('activate', activateHandler, { signal: instanceController.signal });
		this.control();
		return instanceController;
	}

	control() {
		const instanceController = super.control();
		// ONFETCH
		const fetchHandler = (event) => {
			// URL schemes that might arrive here but not supported; e.g.: chrome-extension://
			if (!event.request.url.startsWith('http')) return;
			// Handle external requests
			if (!event.request.url.startsWith(self.origin)) {
				return event.respondWith(this.remoteFetch(event.request));
			}
			if (event.request.mode === 'navigate' || event.request.cache === 'force-cache'/* && event.request.mode === 'navigate' - even webflo client init call also comes with that... needs investigation */) {
				// Now, the following is key:
				// The browser likes to use "force-cache" for "navigate" requests, when, e.g: re-entering your site with the back button
				// Problem here, force-cache forces out JSON not HTML as per webflo's design.
				// So, we detect this scenerio and avoid it.
				event.respondWith((async (event) => {
					const { url, ...requestInit } = await Request.copy(event.request);
					requestInit.cache = 'default';
					return await this.navigate(url, requestInit, { event });
				})(event));
			} else {
				event.respondWith(this.navigate(event.request.url, event.request, { event }));
			}
		};
		const webpushHandler = (event) => {
			if (!(self.Notification && self.Notification.permission === 'granted')) return;
			let data;
			try {
				data = event.data?.json() ?? {};
			} catch(e) { return; }
			const { type, title, ...params } = data;
			if (type !== 'notification') return;
			self.registration.showNotification(title, params);
		};
		self.addEventListener('fetch', fetchHandler, { signal: instanceController.signal });
		self.addEventListener('push', webpushHandler, { signal: instanceController.signal });
		return instanceController;
	}

	async navigate(url, init = {}, detail = {}) {
		// Resolve inputs
		const scopeObj = { url, init, detail };
		if (typeof scopeObj.url === 'string') {
			scopeObj.url = new URL(scopeObj.url, self.location.origin);
		}
		// Create and route request
		scopeObj.request = this.createRequest(scopeObj.url, scopeObj.init);
		scopeObj.cookies = this.createHttpCookies({
			request: scopeObj.request
		});
		scopeObj.session = this.createHttpSession({
			store: this.#sdk.storage?.('session'),
			request: scopeObj.request
		});
		const portID = crypto.randomUUID();
		scopeObj.clientMessagingPort = new ClientMessagingPort(null, portID, { isPrimary: true, honourDoneMutationFlags: true });
		scopeObj.user = this.createHttpUser({
			store: this.#sdk.storage?.('user'),
			request: scopeObj.request,
			session: scopeObj.session,
			client: scopeObj.clientMessagingPort
		});
		scopeObj.httpEvent = this.createHttpEvent({
			request: scopeObj.request,
			cookies: scopeObj.cookies,
			session: scopeObj.session,
			user: scopeObj.user,
			client: scopeObj.clientMessagingPort,
			detail: scopeObj.detail,
			sdk: {}
		});
		// Dispatch for response
		scopeObj.response = await this.dispatchNavigationEvent({
			httpEvent: scopeObj.httpEvent,
			crossLayerFetch: async (event) => {
				// Was this nexted()? Tell the next layer we're in JSON mode by default
				if (event !== scopeObj.httpEvent && !event.request.headers.has('Accept')) {
					event.request.headers.set('Accept', 'application/json');
				}
				return await this.remoteFetch(event.request);
			},
			backgroundMessagingPort: `channel:${scopeObj.httpEvent.client.port.name}`
		});
		if (!scopeObj.response.headers.get('Location') && scopeObj.httpEvent.request.method !== 'GET' && !scopeObj.response.headers.get('Cache-Control')) {
			scopeObj.response.headers.set('Cache-Control', 'no-store');
		}
		return scopeObj.response;
	}

	async remoteFetch(request, ...args) {
		if (arguments.length > 1) {
			request = this.createRequest(request, ...args);
		}
		const scopeObj = {};
		const matchUrl = (patterns, url) => _any((patterns || []).map(p => p.trim()).filter(p => p), p => (new URLPattern(p, self.origin)).test(url));
		if (matchUrl(this.cx.params.cache_only_urls, request.url)) {
			scopeObj.strategy = 'cache-only';
			scopeObj.response = this.cacheFetch(request, { networkFallback: false, cacheRefresh: false });
		} else if (matchUrl(this.cx.params.network_only_urls, request.url)) {
			scopeObj.strategy = 'network-only';
			scopeObj.response = this.networkFetch(request, { cacheFallback: false, cacheRefresh: false });
		} else if (matchUrl(this.cx.params.cache_first_urls, request.url)) {
			scopeObj.strategy = 'cache-first';
			scopeObj.response = this.cacheFetch(request, { networkFallback: true, cacheRefresh: true });
		} else if (matchUrl(this.cx.params.network_first_urls, request.url) || !this.cx.params.default_fetching_strategy) {
			scopeObj.strategy = 'network-first';
			scopeObj.response = this.networkFetch(request, { cacheFallback: true, cacheRefresh: true });
		} else {
			scopeObj.strategy = this.cx.params.default_fetching_strategy;
			switch (this.cx.params.default_fetching_strategy) {
				case 'cache-only':
					scopeObj.response = this.cacheFetch(request, { networkFallback: false, cacheRefresh: false });
					break;
				case 'network-only':
					scopeObj.response = this.networkFetch(request, { cacheFallback: false, cacheRefresh: false });
					break;
				case 'cache-first':
					scopeObj.response = this.cacheFetch(request, { networkFallback: true, cacheRefresh: true });
					break;
				case 'network-first':
					scopeObj.response = this.networkFetch(request, { cacheFallback: true, cacheRefresh: true });
					break;
			}
		}
		return await scopeObj.response;
	}

	async networkFetch(request, params = {}) {
		if (!params.cacheFallback) {
			return fetch(request);
		}
		return fetch(request).then((response) => {
			if (params.cacheRefresh) this.refreshCache(request, response);
			return response;
		}).catch((e) => this.getRequestCache(request).then(cache => {
			return cache.match(request);
		}));
	}

	async cacheFetch(request, params = {}) {
		return this.getRequestCache(request).then(cache => cache.match(request).then((response) => {
			// Nothing cache, use network
			if (!response && params.networkFallback) return this.networkFetch(request, { ...params, cacheFallback: false });
			// Note: fetch, but for refreshing purposes only... not the returned response
			if (response && params.cacheRefresh) this.networkFetch(request, { ...params, justRefreshing: true });
			return response;
		}));
	}

	async refreshCache(request, response) {
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
			cache.put(request, responseToCache);
		});
		return response;
	}

	async getRequestCache(request) {
		const cacheName = request.headers.get('Accept') === 'application/json'
			? this.cx.params.cache_name + '_json'
			: this.cx.params.cache_name;
		return self.caches.open(cacheName);
	}
}