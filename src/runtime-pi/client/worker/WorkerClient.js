
/**
 * @imports
 */
import Router from '../Router.js';
import _WorkerClient from '../../RuntimeClient.js';

export default class RuntimeClient extends _WorkerClient {

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
			const httpMethodName = httpEvent.request.method.toUpperCase();
			let response = await router.route([httpMethodName, 'default'], httpEvent, {}, async event => {
				return remoteFetch(event.request);
			}, remoteFetch);
			if (!(response instanceof httpEvent.Response)) {
                response = httpEvent.Response.compat(response);
            }
            return response;
		};
        return handle();
	}

}

