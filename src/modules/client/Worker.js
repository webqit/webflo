
/**
 * @imports
 */
import Router from './Router.js';
import _isGlobe from 'is-glob';
import Minimatch from 'minimatch';
import _isArray from '@webqit/util/js/isArray.js';
import _afterLast from '@webqit/util/str/afterLast.js';
import _after from '@webqit/util/str/after.js';
import _before from '@webqit/util/str/before.js';
import _any from '@webqit/util/arr/any.js';


/**
 * ---------------------------
 * The Worker Initializer
 * ---------------------------
 */
			
export default function(layout, params) {

	// Copy...
	layout = {...layout};
	params = {...params};

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
		evt.respondWith(handleFetch(evt));
	});

	// Fetches request
	const handleFetch = async evt => {

		const $context = {
			layout,
		};
		// The app router
		const router = new Router(_before(evt.request.url, '?'), layout, $context);
		return await router.route('default', [evt], null, async function() {
			if (_any((params.cache_only_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
				return cache_fetch(evt);
			}
			if (_any((params.cache_first_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
				return cache_fetch(evt, true/** cacheRefresh */);
			}
			if (_any((params.network_first_url_list || []).map(c => c.trim()).filter(c => c), pattern => Minimatch.Minimatch(evt.request.url, pattern))) {
				return network_fetch(evt, true/** cacheFallback */);
			}
			return network_fetch(evt);
		});

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
		// Now, the following is key:
		// The browser likes to use "force-cache" for "navigate" requests
		// when, for example, the back button was used.
		// Thus the origin server would still not be contacted by the self.fetch() below, leading to inconsistencies in responses.
		// So, we detect this scenerio and avoid it.
		// if (evt.request.mode === 'navigate' && evt.request.cache === 'force-cache' && evt.request.destination === 'document') {}
		return self.fetch(evt.request).then(response => refreshCache(evt.request, response)).catch(e => {
			return self.caches.open(getCacheName(evt.request)).then(cache => {
				return cache.match(evt.request);
			});
		});
	};

	// Caches response 
	const refreshCache = (request, response) => {

		// Check if we received a valid response
		if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
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

	// -----------------------------
	
	self.addEventListener('message', evt => {
		const $context = {
			layout,
		};
		const router = new Router('/', layout, $context);
		evt.waitUntil(
			router.route('postmessage', [evt], null, function() {
				return self;
			})
		);
	});

	self.addEventListener('push', evt => {
		const $context = {
			layout,
		};
		const router = new Router('/', layout, $context);
		evt.waitUntil(
			router.route('notificationpush', [evt], null, function() {
				return self;
			})
		);
	});

	self.addEventListener('notificationclick', evt => {
		const $context = {
			layout,
		};
		const router = new Router('/', layout, $context);
		evt.waitUntil(
			router.route('notificationclick', [evt], null, function() {
				return self;
			})
		);
	});

	self.addEventListener('notificationclose', evt => {
		const $context = {
			layout,
		};
		const router = new Router('/', layout, $context);
		evt.waitUntil(
			router.route('notificationclose', [evt], null, function() {
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
relay(messageData) {
	return self.clients.matchAll().then(clientList => {
		clientList.forEach(client => {
			if (client.id === evt.source.id) {
				return;
			}
			client.postMessage(messageData);
		});
	});
};

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