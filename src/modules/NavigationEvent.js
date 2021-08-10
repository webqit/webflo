
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
        this.Response._request = request; 
    }

    // request
    get request() {
        return this._request;
    }

    // url
    get url() {
        return this._url;
    }
}