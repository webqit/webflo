
/**
 * @imports
 */
import Router from './Router.js';
import _isGlobe from 'is-glob';
import Minimatch from 'minimatch';
import { Observer } from '@webqit/pseudo-browser/index2.js';
import _isArray from '@webqit/util/js/isArray.js';
import _afterLast from '@webqit/util/str/afterLast.js';
import _after from '@webqit/util/str/after.js';
import _before from '@webqit/util/str/before.js';
import _any from '@webqit/util/arr/any.js';
import _copy from '@webqit/util/obj/copy.js';
import NavigationEvent from '../NavigationEvent.js';
import StdRequest from './StdRequest.js';

/**
 * ---------------------------
 * The Worker Initializer
 * ---------------------------
 */
			
export default function(layout, params) {

	// Copy...
	layout = { ...layout };
	params = { ...params };
	const sessionStores = Object.create(null);
	const localStores = Object.create(null);

	/**
	 * -------------
	 * ONINSTALL
	 * -------------
	 */

	self.addEventListener('install', evt => {

		if (params.skip_waiting) {
			self.skipWaiting();
		}
		// Manage CACHE
		if (params.cache_name && params.static_caching_list) {
			// Add files to cache
			evt.waitUntil(
				self.caches.open(params.cache_name).then(cache => {
					if (params.lifecycle_logs) {
						console.log('[ServiceWorker] Pre-caching resources.');
					}
					const cache_only_url_list = (params.cache_only_url_list || []).map(c => c.trim()).filter(c => c);//.reduce((all, url) => all.concat(Micromatch.brace(url, { expand: true })), []);
					return cache.addAll(cache_only_url_list.filter(url => !_isGlobe(url) && !_afterLast(url, '.').includes('/')));
				})
			);
		}

	});

	/**
	 * -------------
	 * ONACTIVATE
	 * -------------
	 */

	self.addEventListener('activate', evt => {

		evt.waitUntil(
			new Promise(async resolve => {
				if (params.skip_waiting) {
					await self.clients.claim();
				}
				// Manage CACHE
				if (params.cache_name) {
					// Clear outdated CACHES
					await self.caches.keys().then(keyList => {
						return Promise.all(keyList.map(key => {
							if (key !== params.cache_name && key !== params.cache_name + '_json') {
								if (params.lifecycle_logs) {
									console.log('[ServiceWorker] Removing old cache:', key);
								}
								return self.caches.delete(key);
							}
						}));
					}) 
				}
				resolve();
			})
		);

	});
	  
	/**
	 * -------------
	 * ONFETCH
	 * -------------
	 */

	// Listen now...
	self.addEventListener('fetch', async evt => {
		const _request = new StdRequest(evt.request);
		Object.defineProperty(evt, 'request', { get: () => _request });
		// Fetches request
		const handleFetch = async evt => {

			if (evt.request.url.startsWith(self.origin) && (evt.request.mode === 'navigate' || evt.request.headers.get('X-Powered-By') === '@webqit/webflo')) {
				// -----------------
				// Sync session data to cache to be available to service-worker routers
				// Sync only takes for requests that actually do send the "$session" cookie
				const sessionData = Observer.proxy(sessionStores[evt.clientId] || {});
				const clientNavigationEvent = new NavigationEvent(evt.request, evt.request.url, sessionData);
				// -----------------
				// The app router
				const router = new Router(_before(evt.request.url, '?'), layout, { layout });
				const httpMethodName = evt.request.method.toLowerCase();
				return await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], clientNavigationEvent, null, () => defaultFetch(evt));
			}

			return defaultFetch(evt);
		};
		evt.respondWith(handleFetch(evt));
	});

	const defaultFetch = function(evt) {
		if (_any((params.cache_only_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
			return cache_fetch(evt);
		}
		// Now, the following is key:
		// The browser likes to use "force-cache" for "navigate" requests
		// when, for example, the back button was used.
		// Thus the origin server would still not be contacted by the self.fetch() below, leading to inconsistencies in responses.
		// So, we detect this scenerio and avoid it.
		if (evt.request.mode === 'navigate' && evt.request.cache === 'force-cache' && evt.request.destination === 'document') {
			return cache_fetch(evt, true/** cacheRefresh */);
		}
		if (_any((params.cache_first_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
			return cache_fetch(evt, true/** cacheRefresh */);
		}
		if (_any((params.network_first_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
			return network_fetch(evt, true/** cacheFallback */);
		}
		return network_fetch(evt);
	};

	const getCacheName = request => request.headers.get('Accept') === 'application/json'
			? params.cache_name + '_json' 
			: params.cache_name;
			
	// Caching strategy: cache_first
	const cache_fetch = (evt, cacheRefresh = false) => {

		return self.caches.open(getCacheName(evt.request)).then(cache => {
			return cache.match(evt.request).then(response => {
				if (response) {
					if (cacheRefresh) {
						// Fetch, but return this immediately
						self.fetch(evt.request).then(response => refreshCache(evt.request, response));
					}
					return response;
				}
				return self.fetch(evt.request).then(response => refreshCache(evt.request, response));
			});
		});
		
	};

	// Caching strategy: network_first
	const network_fetch = (evt, cacheFallback) => {
		if (!cacheFallback) {
			return self.fetch(evt.request);
		}
		return self.fetch(evt.request).then(response => refreshCache(evt.request, response)).catch(e => {
			return self.caches.open(getCacheName(evt.request)).then(cache => {
				return cache.match(evt.request);
			});
		});
	};

	// Caches response 
	const refreshCache = (request, response) => {

		// Check if we received a valid response
		if (request.method !== 'GET' || !response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
			return response;
		}

		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();
		self.caches.open(getCacheName(request)).then(cache => {
			if (params.lifecycle_logs) {
				console.log('[ServiceWorker] Refreshing cache:', request.url);
			}
			cache.put(request, responseToCache);
		});

		return response;
	};

	const relay = function(evt, messageData) {
		return self.clients.matchAll().then(clientList => {
			clientList.forEach(client => {
				if (client.id === evt.source.id) {
					return;
				}
				client.postMessage(messageData);
			});
		});
	};

	// -----------------------------
	
	self.addEventListener('message', evt => {
		
		// SESSION_SYNC
		var clientId = evt.source.id;
		if (evt.data && evt.data._type === 'WHOLE_STORAGE_SYNC') {
			const storage = evt.data._persistent ? localStores : sessionStores;
			if (evt.data.store) {
				storage[clientId] = evt.data.store;
				// --------------------------
            	// Get mutations synced TO client
				Observer.observe(storage[clientId], changes => {
					changes.forEach(change => {
						if (!(change.detail || {}).noSync) {
							self.clients.get(clientId).then(client => {
								client.postMessage({ _type: 'STORAGE_SYNC', _persistent: evt.data._persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]), });
							});
						}
					});
				});
				// --------------------------
			} else {
				delete storage[clientId];
			}
		} else if (evt.data && evt.data._type === 'STORAGE_SYNC') {
			// --------------------------
            // Get mutations synced FROM client
			const storage = evt.data._persistent ? localStores : sessionStores;
			if (evt.data.type === 'set') {
				if (storage[clientId]) Observer.set(storage[clientId], evt.data.name, evt.data.value, { detail: { noSync: true } });
			} else if (evt.data.type === 'deletion') {
				if (storage[clientId]) Observer.deleteProperty(storage[clientId], evt.data.name, { detail: { noSync: true } });
			}
			// --------------------------

			// --------------------------
			// Relay to other clients
			if (evt.data._persistent) {
				relay(evt, evt.data);
			}
			// --------------------------
			return;
		}

		// Handle normally
		const router = new Router('/', layout, { layout });
		evt.waitUntil(
			router.route('postmessage', evt, null, function() {
				return self;
			})
		);

	});

	self.addEventListener('push', evt => {
		const router = new Router('/', layout, { layout });
		evt.waitUntil(
			router.route('push', evt, null, function() {
				return self;
			})
		);
	});

	self.addEventListener('notificationclick', evt => {
		const router = new Router('/', layout, { layout });
		evt.waitUntil(
			router.route('notificationclick', evt, null, function() {
				return self;
			})
		);
	});

	self.addEventListener('notificationclose', evt => {
		const router = new Router('/', layout, { layout });
		evt.waitUntil(
			router.route('notificationclose', evt, null, function() {
				return self;
			})
		);
	});

};

/**
 * @utils
 */
const matchClientUrl = (client, url) => '/' + _after(_after(client.url, '//'), '/') === url;

/**

if (notificationData) {
	var title = params.NOTIFICATION_TITLE || '';
	if (_isArray(notificationData)) {
		title = notificationData[0];
		notificationData = notificationData[1];
	}
	return self.registration.showNotification(title, notificationData);
}

var cuurentClientAtUrl = self.clients.matchAll().then(clientList => {
	// Take the user to the app... the current open window or a new window
	return clientList.reduce((cuurentClientAtUrl, client) => {
		return cuurentClientAtUrl || matchClientUrl(client, pathname) ? client : null;
	}, null);
});
if (cuurentClientAtUrl) {
	return cuurentClientAtUrl.focus();
}
return self.clients.openWindow(pathname);

return self.clients.matchAll().then(clientList => {
	// Take the user to the app
	return clientList.reduce((cuurentClientAtUrl, client) => cuurentClientAtUrl || matchClientUrl(client, pathname) ? client : null, null);
});

 */