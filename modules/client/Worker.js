
/**
 * @imports
 */
import Router from './Router.js';
import Minimatch from 'minimatch';
import _after from '@webqit/util/str/after.js';

/**
 * ---------------------------
 * The Worker Initializer
 * ---------------------------
 */
			
export default function(params) {

	// Copy...
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
		if (params.cache_name && params.caching_strategy === 'static' && params.caching_list) {
			// Add files to cache
			evt.waitUntil(
				self.caches.open(params.cache_name).then(cache => {
					if (params.lifecycle_logs) {
						console.log('[ServiceWorker] Pre-caching resources.');
					}
					return cache.addAll(params.caching_list);
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

		// The app router
		const router = new Router(evt.request.url, params);
		// The srvice object
		const routingPayload = {
			params,
			request: evt.request,
			scope: evt,
		}
		return await router.route([routingPayload], 'default', async function(response) {
			if (arguments.length) {
				return response;
			}
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
		if (params.caching_strategy === 'static' || !response || response.status !== 200 || response.type !== 'basic'
		|| ((params.caching_list || []).filter(c => c.trim()).length && !params.caching_list.reduce((matched, pattern) => matched || Minimatch(request.url, pattern, {dot: true}), false))) {
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
	
	if (params.support_messaging) {
		
		/**
		 * -------------
		 * ON-MESSAGE
		 * -------------
		 */

		self.addEventListener('message', evt => {
			var messageRoutingUrl = '/';
			if (params.message_routing_url_property && evt.data[params.message_routing_url_property]) {
				messageRoutingUrl = evt.data[params.message_routing_url_property];
			}
			// The app router
			const router = new Router(messageRoutingUrl, params);
			// The srvice object
			const routingPayload = {
				params,
				evt,
				scope: self,
			}
			evt.waitUntil(
				router.route([routingPayload], 'message', async function(messageData) {
					if (arguments.length) {
						return messageData;
					}
					return evt.data.json(); // Promise
				}).then(messageData => {
					if (messageData && params.message_relay_flag_property && messageData[params.message_relay_flag_property]) {
						return self.clients.matchAll().then(clientList => {
							clientList.forEach(client => {
								if (client.id === evt.source.id) {
									return;
								}
								client.postMessage({
									isMessageRelay: true,
									sourceId: evt.source.id,
									message: messageData,
								});
							});
						});
					}
				})
			);
		});
	}

	// -----------------------------

	if (params.support_notification) {
		
		/**
		 * -------------
		 * ON-PUSH
		 * -------------
		 */

		self.addEventListener('push', evt => {
			var notificationRoutingUrl = '/';
			if (params.notification_routing_url_property && evt.data[params.notification_routing_url_property]) {
				notificationRoutingUrl = evt.data[params.notification_routing_url_property];
			}
			// The app router
			const router = new Router(notificationRoutingUrl, params);
			// The srvice object
			const routingPayload = {
				params,
				evt,
				scope: self,
			}
			evt.waitUntil(
				router.route([routingPayload], 'notice', async function(notificationData) {
					if (arguments.length) {
						return notificationData;
					}
					try {
						return evt.data.json(); // Promise
					} catch(e) {
						return evt.data.text(); // Promise
					}
				}).then(notificationData => {
					if (notificationData) {
						return self.registration.showNotification(params.NOTIFICATION_TITLE || '', notificationData);
					}
				})
			);
		});
		
		/**
		 * -------------
		 * ON-NOTIFICATION...
		 * -------------
		 */

		self.addEventListener('notificationclick', evt => {
			var notificationTargetUrl = '/';
			if (params.notification_target_url_property && evt.notification[params.notification_target_url_property]) {
				notificationTargetUrl = evt.notification[params.notification_target_url_property];
			}
			// The app router
			const router = new Router(notificationTargetUrl, params);
			// The srvice object
			const routingPayload = {
				params,
				evt,
				scope: self,
			}
			evt.waitUntil(
				router.route([routingPayload], 'target', async function(cuurentClientAtUrl) {
					if (arguments.length) {
						return cuurentClientAtUrl;
					}
					return self.clients.matchAll().then(clientList => {
						// Take the user to the app... the current open window or a new window
						return clientList.reduce((cuurentClientAtUrl, client) => {
							return cuurentClientAtUrl || matchClientUrl(client, notificationTargetUrl) ? client : null;
						}, null);
					});
				}).then(cuurentClientAtUrl => {
					if (cuurentClientAtUrl) {
						return cuurentClientAtUrl.focus();
					}
					return self.clients.openWindow(notificationTargetUrl); // Promise
				}).then(cuurentClientAtUrl => {
					// Let client know that a notification for it has been clicked
					return cuurentClientAtUrl.postMessage({
						isNotificationTargetEvent: true,
						notification: evt.notification.data,
					});
				})
			);
		});

		// -----------------------------

		self.addEventListener('notificationclose', evt => {
			var notificationTargetUrl = '/';
			if (params.notification_target_url_property && evt.notification[params.notification_target_url_property]) {
				notificationTargetUrl = evt.notification[params.notification_target_url_property];
			}
			// The app router
			const router = new Router(notificationTargetUrl, params);
			// The srvice object
			const routingPayload = {
				params,
				evt,
				scope: self,
			}
			evt.waitUntil(
				router.route([routingPayload], 'untarget', async function(cuurentClientAtUrl) {
					if (arguments.length) {
						return cuurentClientAtUrl;
					}
					return self.clients.matchAll().then(clientList => {
						// Take the user to the app
						return clientList.reduce((cuurentClientAtUrl, client) => cuurentClientAtUrl || matchClientUrl(client, notificationTargetUrl) ? client : null, null);
					});
				}).then(cuurentClientAtUrl => {
					if (cuurentClientAtUrl) {
						// Let client know that a notification for it has been closed
						return cuurentClientAtUrl.postMessage({
							isNotificationUntargetEvent: true,
							notification: evt.notification.data,
						});
					}
				})
			);
		});
	}

};

/**
 * @utils
 */
const matchClientUrl = (client, url) => '/' + _after(_after(client.url, '//'), '/') === url;