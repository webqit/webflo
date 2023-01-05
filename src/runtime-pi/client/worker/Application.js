
/**
 * @imports
 */
import Router from '../Router.js';
import _Application from '../../Application.js';

export default class Application extends _Application {

	// Returns router class
	get Router() {
		return Router;
	}

	/**
     * Handles HTTP events.
     * 
     * @param HttpEvent       httpEvent
     * @param Function        remoteFetch
     * 
     * @return Response
     */
	async handle(httpEvent, remoteFetch) {
		// The app router
        const router = new this.Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
			// --------
			// ROUTE FOR DATA
			// --------
			return router.route([httpEvent.request.method, 'default'], httpEvent, {}, async event => {
				if (event !== httpEvent) {
					// This was nexted()
					if (!event.request.headers.has('Accept')) {
						event.request.headers.set('Accept', 'application/json');
					}
				}
				return remoteFetch(event.request);
			}, remoteFetch);
		};
        return handle();
	}

}

