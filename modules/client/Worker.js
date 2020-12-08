
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

		if (params.SKIP_WAITING) {
			self.skipWaiting();
		}
		// Manage CACHE
		if (params.CACHE_NAME && params.CACHING_STRATEGY === 'static' && params.CACHING_LIST) {
			// Add files to cache
			evt.waitUntil(
				self.caches.open(params.CACHE_NAME).then(cache => {
					if (params.SHOW_LIFECYCLE_LOG) {
						console.log('[ServiceWorker] Pre-caching resources.');
					}
					return cache.addAll(params.CACHING_LIST);
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
				if (params.SKIP_WAITING) {
					await self.clients.claim();
				}
				// Manage CACHE
				if (params.CACHE_NAME) {
					// Clear outdated CACHES
					await self.caches.keys().then(keyList => {
						return Promise.all(keyList.map(key => {
							if (key !== params.CACHE_NAME) {
								if (params.SHOW_LIFECYCLE_LOG) {
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
	self.addEventListener('fetch', evt => {
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
			switch(params.FETCHING_STRATEGY) {
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

	// Caching strategy: cache_first
	const cache_first_fetch = evt => {

		return self.caches.open(params.CACHE_NAME).then(cache => {
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

		return self.fetch(evt.request).then(response => handleFetchResponse(evt.request, response)).catch(() => {
			return self.caches.open(params.CACHE_NAME).then(cache => {
				return cache.match(evt.request);
			});
		});

	};

	// Caches response 
	const handleFetchResponse = (request, response) => {

		// Check if we received a valid response
		if (params.CACHING_STRATEGY === 'static' || !response || response.status !== 200 || response.type !== 'basic'
		|| ((params.CACHING_LIST || []).filter(c => c.trim()).length && !params.CACHING_LIST.reduce((matched, pattern) => matched || Minimatch(request.url, pattern, {dot: true}), false))) {
			return response;
		}

		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();
		self.caches.open(params.CACHE_NAME).then(cache => {
			if (params.SHOW_LIFECYCLE_LOG) {
				console.log('[ServiceWorker] Caching new resource:', request.url);
			}
			cache.put(request, responseToCache);
		});

		return response;
	};

	// -----------------------------
	
	if (params.SUPPORT_MESSAGING) {
		
		/**
		 * -------------
		 * ON-MESSAGE
		 * -------------
		 */

		self.addEventListener('message', evt => {
			var messageRoutingUrl = '/';
			if (params.MESSAGE_ROUTING_URL_PROPERTY && evt.data[params.MESSAGE_ROUTING_URL_PROPERTY]) {
				messageRoutingUrl = evt.data[params.MESSAGE_ROUTING_URL_PROPERTY];
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
					if (messageData && params.MESSAGE_SHOULD_RELAY_PROPERTY && messageData[params.MESSAGE_SHOULD_RELAY_PROPERTY]) {
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

	if (params.SUPPORT_NOTIFICATION) {
		
		/**
		 * -------------
		 * ON-PUSH
		 * -------------
		 */

		self.addEventListener('push', evt => {
			var notificationRoutingUrl = '/';
			if (params.NOTIFICATION_ROUTING_URL_PROPERTY && evt.data[params.NOTIFICATION_ROUTING_URL_PROPERTY]) {
				notificationRoutingUrl = evt.data[params.NOTIFICATION_ROUTING_URL_PROPERTY];
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
			if (params.NOTIFICATION_TARGET_URL_PROPERTY && evt.notification[params.NOTIFICATION_TARGET_URL_PROPERTY]) {
				notificationTargetUrl = evt.notification[params.NOTIFICATION_TARGET_URL_PROPERTY];
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
			if (params.NOTIFICATION_TARGET_URL_PROPERTY && evt.notification[params.NOTIFICATION_TARGET_URL_PROPERTY]) {
				notificationTargetUrl = evt.notification[params.NOTIFICATION_TARGET_URL_PROPERTY];
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