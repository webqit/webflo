
/**
 * ---------------------------
 * The base RuntimeClient class
 * ---------------------------
 */
            
export default class RuntimeClient {

    constructor(cx) {
        this.cx = cx;
    }
    
	/**
     * Initializes application itself.
     * 
     * @param HttpEvent       httpEvent
     * @param Function        remoteFetch
     * 
     * @return Boolean|undefined
     */
	async init(httpEvent, remoteFetch) {
		// The app router
        const router = new this.Router(this.cx, '/');
        return router.route(['init'], httpEvent, {}, async event => {
		}, remoteFetch);
	}

}