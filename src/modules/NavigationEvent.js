
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
     * @param Object        sessionStore 
     */
    constructor(_request, _url, _session = null) {
        this._request = _request;
        if (_url instanceof XURL) {
            this._url = _url;
        } else {
            this._url = new XURL(_url);
        }
        this._session = _session;
        this.Response = Response;
        this.Response._request = _request; 
    }

    // request
    get request() {
        return this._request;
    }

    // url
    get url() {
        return this._url;
    }

    // session
    get session() {
        return this._session;
    }

    // RDR
    withUrl(newUri) {
        return new this.constructor(this._request, new XURL(
            this._url.origin + newUri
        ), this._session);
    }
}