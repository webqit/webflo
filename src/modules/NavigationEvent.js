
/**
 * @imports
 */

/**
 * The ClientNavigationEvent class
 */
export default class NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     * @param Response response 
     */
    constructor(request, response) {
        this._request = request;   
        this._response = response;   
    }

    // Request
    get request() {
        return this._request;
    }

    // Response
    get response() {
        return this._response;
    }

    // Inputs
    get inputs() {
        return this.getPayload().then(payload => payload.inputs);
    }

    // Files
    get files() {
        return this.getPayload().then(payload => payload.files);
    }

    // Files
    respondWith(response) {
        this._response = response;
    }

    // Walk
    // Piping utility
    async walk(...stack) {
        var val;
        var next = async function() {
            var middleware = stack.shift();
            if (middleware) {
                val = await middleware(this.request, this.response, next);
                return val;
            }
        };
        await next();
        return val;
    }
}