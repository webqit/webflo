
/**
 * @imports
 */
import Response from "./Response.js";

/**
 * The ClientNavigationEvent class
 */
export default class NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     */
    constructor(request) {
        this._request = request;   
        this.Response = Response;
        this.requestParse = {
            payloadPromise: null,
            cookies: null,
            accepts: null,
        };
    }

    // Request
    get request() {
        return this._request;
    }
     
    // Payload
    getPayload() {
        if (!this.requestParse.payloadPromise) {
            this.requestParse.payloadPromise = this.constructor.parseRequestBody(this.request);
        }
        return this.requestParse.payloadPromise;
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