
/**
 * @imports
 */
import Router from './Router.js';

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

		// Manage CACHE
		if (params.CACHE_NAME) {
			if (params.FILES_TO_CACHE) {
				// Add files to cache
				evt.waitUntil(caches.open(params.CACHE_NAME).then(cache => {
					console.log('[ServiceWorker] Pre-caching offline page');
					return cache.addAll(params.FILES_TO_CACHE);
				}));
			}
			// Clear outdated CACHES
			evt.waitUntil(caches.keys().then(keyList => {
				return Promise.all(keyList.map(key => {
					if (key !== params.CACHE_NAME) {
						console.log('[ServiceWorker] Removing old cache', key);
						return caches.delete(key);
					}
				}));
			}));
		}

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
		const requestPath = (evt.request + '').split('?')[0];
		const router = new Router(requestPath, params);

		// The srvice object
		const service = {
			params,
			request: evt.request,
		}
		return await router.route([service], 'default', async function(response) {
			if (arguments.length) {
				return response;
			}
			switch(params.FETCHING_STRATEGY) {
				case 'cache_first':
					cache_first_fetch(evt);
				break;
				case 'network_first':
				default:
					network_first_fetch(evt);
				break;
			}
		});

	};

	// Caching strategy: cache_first
	const cache_first_fetch = evt => {
		return caches.open(params.CACHE_NAME).then(cache => {
			return cache.match(evt.request).then(response => {
				if (response) {
					return response;
				}
				return fetch(evt.request).then(handleFetchResponse);
			});
		});
	};

	// Caching strategy: network_first
	const network_first_fetch = evt => {
		return fetch(evt.request).then(handleFetchResponse).catch(() => {
			return caches.open(params.CACHE_NAME).then(cache => {
				return cache.match(evt.request);
			});
		});
	};

	// Caches response 
	const handleFetchResponse = response => {
			// Check if we received a valid response
		if (params.CACHING_STRATEGY !== 'dynamic' || !response || response.status !== 200 || response.type !== 'basic') {
			return response;
		}

		// IMPORTANT: Clone the response. A response is a stream
		// and because we want the browser to consume the response
		// as well as the cache consuming the response, we need
		// to clone it so we have two streams.
		var responseToCache = response.clone();

		caches.open(params.CACHE_NAME).then(cache => {
			cache.put(evt.request, responseToCache);
		});

		return response;
  	};

};