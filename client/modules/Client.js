
/**
 * @imports
 */
import Observer from '@web-native-js/observer';
import _isFunction from '@onephrase/util/js/isFunction.js';
import _isObject from '@onephrase/util/js/isObject.js';
import _promise from '@onephrase/util/js/promise.js';
import Router from './Router.js';
import Url from './Url.js';

/**
 * ---------------------------
 * The Client class
 * ---------------------------
 */
			
export default class Client {

	/**
	 * Constructs a new Client instance. Typically,
	 * only one instance would be needed app-wide. So an should
	 * be used as a singleton.
	 * 
	 * @param object 	params
	 *
	 * @return void
	 */
	constructor(params) {
		/**
		 * ----------------
		 * Client.location
		 * ----------------
		 */
		Observer.set(this, 'location', new Url(window.document.location, params.pathnamingScheme));
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
				Observer.set(this.location, Url.copy(window.document.location), {
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
			&& (!anchor.origin || anchor.origin === this.location.origin)
			&& !anchor.getAttribute('target')) {
				e.preventDefault();
				var e2 = Observer.set(this.location, 'href', href, {
					src: anchor
				});
				if (e2 && e2.defaultPrevented) {
				}
			}
		});
		/**
		 * ----------------
		 * Client.history
		 * ----------------
		 */
		this.history = window.history;
		// -----------------------
		// Syndicate changes to
		// the browser;s location bar
		Observer.observe(this.location, 'href', delta => {
			if (delta.value === window.document.location.href) {
				this.history.replaceState(this.history.state, '', delta.value);
			} else {
				this.history.pushState(this.history.state, '', delta.value);
			}
		});
		/**
		 * ----------------
		 * Apply routing
		 * ----------------
		 */
		const router = new Router(params.routes);
		const route = async request => {
			// ------------------------
			// Route...
			var data = await router.route(request);
			
			// ------------------------
			// Render...
			return await _promise(resolve => {
				(new Promise(resolve => {
					if (document.templatesReadyState === 'complete') {
						resolve();
					} else {
						document.addEventListener('templatesreadystatechange', resolve);
					}
				})).then(async () => {
					document.body.setAttribute('template', (params.templateRoutePath || 'app') + request.url.pathname);
					document.bind(data, {update:true});
					resolve(data);
				});
			});
		};

		// Observe location and route
		Observer.observe(this.location, 'href', async delta => {
			var data = await route({
				url:this.location,
				headers: delta.detail || {},
			});
		});
		
		// Startup route?
		if (!params.isomorphic) {
			route({
				url:this.location,
				headers:{},
			});
		}
	}
	
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