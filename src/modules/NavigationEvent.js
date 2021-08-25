
/**
 * @imports
 */
import Response from "./Response.js";
import XURL from './XURL.js';

/**
 * The ClientNavigationEvent class
 */
export default class NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request       request 
     * @param String|XURL   url 
     */
    constructor(request, url) {
        this._request = request;
        if (url instanceof XURL) {
            this._url = url;
        } else {
            this._url = new XURL(url);
        }
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

    // RDR
    withRedirect(newUri) {
        return new this.constructor(this._request, new XURL(
            this._url.origin + newUri
        ));
    }
}