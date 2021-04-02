
/**
 * @imports
 */
import Router from './Router.js';
import Minimatch from 'minimatch';
import _isArray from '@webqit/util/js/isArray.js';
import _after from '@webqit/util/str/after.js';

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
					return cache.addAll(params.static_caching_list);
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
		const router = new Router(evt.request.url, layout, $context);
		// The srvice object
		const routingPayload = {
			params,
			request: evt.request,
			scope: evt,
		}
		return await router.route('default', [evt.request], null, async function() {
			switch(params.fetching_strategy) {
				case 'cache_first':
					return cache_first_fetch(evt);
				break;
				case 'network_first':
				default:
					return network_first_fetch(evt);
				break;
			}
		});

	};

	const getCacheName = request => request.headers.get('Accept') === 'application/json'
			? params.cache_name + '_json' 
			: params.cache_name;
			
	// Caching strategy: cache_first
	const cache_first_fetch = evt => {

		return self.caches.open(getCacheName(evt.request)).then(cache => {
			return cache.match(evt.request).then(response => {
				if (response) {
					return response;
				}
				return self.fetch(evt.request).then(response => handleFetchResponse(evt.request, response));
			});
		});
		
	};

	// Caching strategy: network_first
	const network_first_fetch = evt => {

		// Now, the following is key:
		// The browser likes to use "force-cache" for "navigate" requests
		// when, for example, the back button was used.
		// Thus the origin server would still not be contacted by the self.fetch() below, leading inconsistencies in responses.
		// So, we detect this scenerio and avoid it.
		// if (evt.request.mode === 'navigate' && evt.request.cache === 'force-cache' && evt.request.destination === 'document') {}
		return self.fetch(evt.request).then(response => handleFetchResponse(evt.request, response)).catch(() => {
			return self.caches.open(getCacheName(evt.request)).then(cache => {
				return cache.match(evt.request);
			});
		});

	};

	// Caches response 
	const handleFetchResponse = (request, response) => {

		// Check if we received a valid response
		if (!response || response.status !== 200 || response.type !== 'basic'
		|| (!(params.dynamic_caching_list || []).map(c => c.trim()).filter(c => c).reduce((matched, pattern) => matched || Minimatch(request.url, pattern, {dot: true}), false))) {
			return response;
		}

		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();
		self.caches.open(getCacheName(request)).then(cache => {
			if (params.lifecycle_logs) {
				console.log('[ServiceWorker] Caching new resource:', request.url);
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