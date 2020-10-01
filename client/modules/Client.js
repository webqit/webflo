
/**
 * @imports
 */
import _promise from '@onephrase/util/js/promise.js';
import Router from './Router.js';
import Http from './Http.js';

/**
 * ---------------------------
 * The Client class
 * ---------------------------
 */
			
export default function(params) {

	params = {...params};

	/**
	 * ----------------
	 * Apply routing
	 * ----------------
	 */	
	Http.createClient(async request => {

        // -------------------
        // Resolve canonicity
        // -------------------
		
		// The app router
		const requestPath = request.url.split('?')[0];
		const router = new Router(requestPath, params);

		// The srvice object
		const service = {
			offsetUrl: params.offsetUrl,
			request,
		}

		var data;
		try {

			// --------
			// ROUTE FOR DATA
			// --------
			data = await router.route([service], 'default', async function(output) {
				if (arguments.length) {
					return output;
				}
				return window.fetch(requestPath, {
					headers: {
						accept: 'application/json'
					}
				}).then(response => response.json()).catch(() => {});
			});

			// --------
			// Render
			// --------
			const _window = await router.route([data], 'render', async function(_window) {
				if (arguments.length) {
					return _window;
				}
				// --------
				window.document.bind(data, {update: Object.keys(window.document.bindings).length !== 0});
				window.document.body.setAttribute('template', 'app' + requestPath);
				return window;
			});

			// --------
			// Render...
			// --------
			data = await _promise(resolve => {
				(new Promise(resolve => {
					if (_window.document.templatesReadyState === 'complete') {
						resolve();
					} else {
						_window.document.addEventListener('templatesreadystatechange', resolve);
					}
				})).then(async () => {
					resolve(data);
				});
			});

			return data;

		} catch(e) {throw e}
		
	});

};