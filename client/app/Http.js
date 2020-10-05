
/**
 * @imports
 */
import Observer from '@web-native-js/observer';
import _before from '@onephrase/util/str/before.js';
import _after from '@onephrase/util/str/after.js';
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
					request,
					src,
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
				Observer.set(instance.location, Url.copy(window.document.location), {
					src: window.document.location
				});
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
			// Not same href
			&& (_before(href, '#') !== _before(instance.location.href, '#'))
			// And not towards any target
			&& !anchor.getAttribute('target')) {
				e.preventDefault();
				var e2 = Observer.set(instance.location, 'href', href, {
					src: anchor
				});
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
		});

		// ----------------------------------
		const createRequest = () => {
			var url = _after(instance.location.href, instance.location.origin);
			return {
				url: _before(url, '#'),
				headers:{
					host: instance.location.host,
				},
			};
		};
		// ----------------------------------

		// Observe location and route
		Observer.observe(instance.location, 'href', async delta => {
			return await client.call(null, createRequest());
		});
		
		// Startup route?
		if (!window.Chtml || !window.Chtml.meta('isomorphic')) {
			client.call(null, createRequest());
		}

		return instance;
	}

};