
/**
 * @imports
 */
import Observer from '@web-native-js/observer';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import Url from './Url.js';

/**
 * ---------------------------
 * The Client class
 * ---------------------------
 */
			
export default class Http {

	/**
	 * Constructs a new Http instance. Typically,
	 * 
	 * @param function 	client
	 * @param object 	params
	 *
	 * @return void
	 */
	static createClient(client, params = {}) {

		/**
		 * ----------------
		 * instance
		 * ----------------
		 */
		const instance = {

			/**
			 * Performs a request.
			 *
			 * @param string 	href
			 * @param object 	request
			 * @param object 	src
			 *
			 * @return UserEvent
			 */
			go(href, request = {}, src = null) {
				return Observer.set(this.location, 'href', href, {
					detail: {request, src,},
				});
			}
		};

		/**
		 * ----------------
		 * instance.location
		 * ----------------
		 */
		Observer.set(instance, 'location', new Url(window.document.location, params.PATH_NAMING_SCHEME));
		// -----------------------
		// This event is triggered by
		// either the browser back button,
		// the window.history.back(),
		// the window.history.forward(),
		// or the window.history.go() action.
		window.addEventListener('popstate', e => {
			// Needed to alow window.document.location
			// to update to window.location
			window.setTimeout(() => {
				// Only on "href" change or on same "href" but no "hash"
				// In other words, same "href" "hash"-based navigation should be natural
				if ((_before(window.document.location.href, '#') !== _before(instance.location.href, '#')) || !window.document.location.href.includes('#')) {
					Observer.set(instance.location, Url.copy(window.document.location), {
						detail: {src: window.document.location},
					});
				}
			}, 0);
		});
		// -----------------------
		// Capture all link-clicks
		// and fire to this router.
		window.addEventListener('click', e => {
			var anchor, href, target;
			if ((anchor = e.target.closest('a')) 
			&& (href = anchor.href)
			// Same origin... but...
			&& (!anchor.origin || anchor.origin === instance.location.origin)
			// And not towards any target
			&& !anchor.getAttribute('target')) {
				// Only on "href" change or on same "href" but no "hash"
				// In other words, same "href" "hash"-based navigation should be natural
				var sameHref = _before(href, '#') === _before(window.document.location.href, '#');
				if (!sameHref || !href.includes('#')) {
					e.preventDefault();
					if (!sameHref) {
						var eventObject = Observer.set(instance.location, 'href', href, {
							detail: {src: anchor,},
							eventObject: true,
						});
					}
				}
			}
		});
		/**
		 * ----------------
		 * instance.history
		 * ----------------
		 */
		instance.history = window.history;
		// -----------------------
		// Syndicate changes to
		// the browser;s location bar
		Observer.observe(instance.location, 'href', delta => {
			if (delta.value === window.document.location.href) {
				instance.history.replaceState(instance.history.state, '', delta.value);
			} else {
				instance.history.pushState(instance.history.state, '', delta.value);
			}
		}, {diff: true});

		// ----------------------------------
		const createRequest = referrer => {
			var url = instance.location.href;
			var options = {
				headers: {host: instance.location.host,},
				referrer,
			};
			if (typeof Request !== 'undefined') {
				return new Request(url, options);
			}
			return {url, ...options};
		};
		// ----------------------------------

		// Observe location and route
		Observer.observe(instance.location, 'href', async delta => {
			return await client.call(null, createRequest(delta.oldValue));
		}, {diff: true});
		// Startup route
		client.call(null, createRequest(document.referrer), true/* initCall */);

		return instance;
	}

};