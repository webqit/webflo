
/**
 * @imports
 */
import Router from '../Router.js';

export default class WorkerClient {

	/**
     * WorkerClient
     * 
     * @param Context cx
     */
	constructor(cx) {
		this.cx = cx;
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
        const router = new Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
			// --------
			// ROUTE FOR DATA
			// --------
			let httpMethodName = httpEvent.request.method.toLowerCase();
			let response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], httpEvent, {}, async event => {
				return remoteFetch(event.request);
			}, remoteFetch);
			if (!(response instanceof httpEvent.Response)) {
                response = new httpEvent.Response(response);
            }
            return response;
		};
        return handle();
	}

}

