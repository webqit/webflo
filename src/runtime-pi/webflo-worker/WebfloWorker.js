import { _any } from '@webqit/util/arr/index.js';
import { RequestPlus } from '@webqit/fetch-plus';
import { URLPatternPlus } from '@webqit/url-plus';
import { WorkerSideWorkport } from './WorkerSideWorkport.js';
import { HttpThread111 } from '../webflo-routing/HttpThread111.js';
import { HttpCookies110 } from '../webflo-routing/HttpCookies110.js';
import { HttpSession110 } from '../webflo-routing/HttpSession110.js';
import { HttpUser111 } from '../webflo-routing/HttpUser111.js';
import { HttpEvent111 } from '../webflo-routing/HttpEvent111.js';
import { KeyvalsFactory110 } from '../webflo-routing/KeyvalsFactory110.js';
import { ClientRequestPort010 } from '../webflo-messaging/ClientRequestPort010.js';
import { AppRuntime } from '../AppRuntime.js';

export class WebfloWorker extends AppRuntime {

	static get Workport() { return WorkerSideWorkport; }

	#keyvals;
	get keyvals() { return this.#keyvals; }

	async initialize() {
		// ----------
		// The keyvals API
		this.#keyvals = new KeyvalsFactory110;

		// ----------
		// Call default-init
		const instanceController = await super.initialize();

		// ONINSTALL
		const installHandler = (event) => {
			if (this.config.WORKER.skip_waiting) self.skipWaiting();
			// Manage CACHE
			if (this.config.WORKER.cache_name && (
				(this.config.WORKER.cache_first_urls || []).length || (this.config.WORKER.cache_only_urls || []).length
			)) {
				// Add files to cache
				event.waitUntil(self.caches.open(this.config.WORKER.cache_name).then(async cache => {
					if (this.cx.logger) { this.cx.logger.log('[ServiceWorker] Pre-caching resources.'); }
					const promises = [];
					for (const key of ['cache_first_urls', 'cache_only_urls']) {
						const urls = this.config.WORKER[key];
						if (!urls?.length) continue;
						const _urls = urls.map((c) => c.trim()).filter(c => c && !(new URLPatternPlus(c, self.origin)).isPattern());
						for (let url of _urls) {
							//url = new URL(url, self.origin).href;
							promises.push(fetch(url).then(async (res) => {
								if (!res.ok) return 0;
								await cache.put(url, res);
								return 1;
							}).catch(() => -1));
						}
					}
					await Promise.all(promises);
				}));
			}
		};
		self.addEventListener('install', installHandler, { signal: instanceController.signal });

		// ONACTIVATE
		const activateHandler = (event) => {
			event.waitUntil(new Promise(async resolve => {
				if (this.config.WORKER.skip_waiting) { await self.clients.claim(); }
				// Manage CACHE
				if (this.config.WORKER.cache_name) {
					// Clear outdated CACHES
					await self.caches.keys().then(keyList => {
						return Promise.all(keyList.map(key => {
							if (key !== this.config.WORKER.cache_name && key !== this.config.WORKER.cache_name + '_json') {
								if (this.cx.logger) { this.cx.logger.log('[ServiceWorker] Removing old cache:', key); }
								return self.caches.delete(key);
							}
						}));
					})
				}
				resolve();
			}));
		};
		self.addEventListener('activate', activateHandler, { signal: instanceController.signal });

		this.control();

		return instanceController;
	}

	control() {
		const instanceController = super.control();
		// ONFETCH
		const fetchHandler = (event) => {
			// Handle special requests
			if (!event.request.url.startsWith('http') || event.request.mode === 'navigate') {
				return event.respondWith(fetch(event.request));
			}
			// Handle external requests
			if (!event.request.url.startsWith(self.origin)) {
				return event.respondWith(this.remoteFetch(event.request));
			}
			event.respondWith((async (event) => {
				const response = await this.navigate(event.request.url, event.request, { event });
				return response;
			})(event));
		};
		const webpushHandler = (event) => {
			if (!(self.Notification && self.Notification.permission === 'granted')) return;
			let data;
			try {
				data = event.data?.json() ?? {};
			} catch (e) { return; }
			const { type, title, ...params } = data;
			if (type !== 'notification') return;
			self.registration.showNotification(title, params);
		};
		self.addEventListener('fetch', fetchHandler, { signal: instanceController.signal });
		if (this.config.CLIENT.capabilities.webpush) {
			self.addEventListener('push', webpushHandler, { signal: instanceController.signal });
		}
		return instanceController;
	}

	async navigate(url, init = {}, detail = {}) {
		// Scope object
		const scopeObj = {
			url,
			init,
			detail,
			requestID: (0 | Math.random() * 9e6).toString(36),
			tenantID: 'anon',
		};
		if (typeof scopeObj.url === 'string') {
			scopeObj.url = new URL(scopeObj.url, self.location.origin);
		}

		// Request
		scopeObj.request = scopeObj.init instanceof Request && scopeObj.init.url === scopeObj.url.href
			? scopeObj.init
			: this.createRequest(scopeObj.url, scopeObj.init);
		RequestPlus.upgradeInPlace(scopeObj.request);

		// Origins
		const origins = [scopeObj.requestID];

		// Thread
		scopeObj.thread = HttpThread111.create({
			context: {},
			store: this.#keyvals.create({ path: ['thread', scopeObj.tenantID], origins, ttl: 60*60*24*30/* 30 days */ }),
			threadID: scopeObj.url.searchParams.get('_thread'),
			realm: 2
		});

		// Cookies
		const type = typeof cookieStore === 'undefined' ? 'inmemory' : 'cookiestore';
		scopeObj.cookies = HttpCookies110.create({
			context: { handlersRegistry: this.#keyvals.getHandlers('cookies', true) },
			store: this.#keyvals.create({ type, path: ['cookies', scopeObj.tenantID], origins }),
			realm: 2
		});

		// Session
		scopeObj.session = HttpSession110.create({
			context: { handlersRegistry: this.#keyvals.getHandlers('session', true) },
			store: this.#keyvals.create({ path: ['session', scopeObj.tenantID], origins }),
			realm: 2
		});

		// User
		scopeObj.user = HttpUser111.create({
			context: { handlersRegistry: this.#keyvals.getHandlers('user', true) },
			store: this.#keyvals.create({ path: ['user', scopeObj.tenantID], origins }),
			realm: 2
		});

		// Client
		scopeObj.clientRequestRealtime = new ClientRequestPort010(scopeObj.requestID, { handshake: 1, postAwaitsOpen: true, clientServerMode: 'server', autoClose: true });

		// HttpEvent
		scopeObj.httpEvent = HttpEvent111.create({
			detail: scopeObj.detail,
			signal: init.signal,
			request: scopeObj.request,
			thread: scopeObj.thread,
			cookies: scopeObj.cookies,
			session: scopeObj.session,
			user: scopeObj.user,
			client: scopeObj.clientRequestRealtime,
			realm: 2
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
			clientPortB: `channel://${scopeObj.httpEvent.client.name}`
		});
		return scopeObj.response;
	}

	async remoteFetch(request, ...args) {
		if (arguments.length > 1) {
			request = this.createRequest(request, ...args);
		}
		const scopeObj = {};
		const matchUrl = (patterns, url) => _any((patterns || []).map(p => p.trim()).filter(p => p), p => (new URLPattern(p, self.origin)).test(url));
		if (matchUrl(this.config.WORKER.cache_only_urls, request.url)) {
			scopeObj.strategy = 'cache-only';
			scopeObj.response = this.cacheFetch(request, { networkFallback: false, cacheRefresh: false });
		} else if (matchUrl(this.config.WORKER.network_only_urls, request.url)) {
			scopeObj.strategy = 'network-only';
			scopeObj.response = this.networkFetch(request, { cacheFallback: false, cacheRefresh: false });
		} else if (matchUrl(this.config.WORKER.cache_first_urls, request.url)) {
			scopeObj.strategy = 'cache-first';
			scopeObj.response = this.cacheFetch(request, { networkFallback: true, cacheRefresh: true });
		} else if (matchUrl(this.config.WORKER.network_first_urls, request.url) || !this.config.WORKER.default_fetching_strategy) {
			scopeObj.strategy = 'network-first';
			scopeObj.response = this.networkFetch(request, { cacheFallback: true, cacheRefresh: true });
		} else {
			scopeObj.strategy = this.config.WORKER.default_fetching_strategy;
			switch (this.config.WORKER.default_fetching_strategy) {
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
		const statusCode = response.status;
		if (request.method !== 'GET' || !response || statusCode !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
			return response;
		}
		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();
		await this.getRequestCache(request).then(cache => {
			cache.put(request, responseToCache);
		});
		return response;
	}

	async getRequestCache(request) {
		const cacheName = request.headers.get('X-Powered-By') === '@webqit/webflo'
			? this.config.WORKER.cache_name + '_csr'
			: this.config.WORKER.cache_name;
		return self.caches.open(cacheName);
	}
}