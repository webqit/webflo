
/**
 * @imports
 */
import { _isEmpty } from '@webqit/util/js/index.js';
import xRequest from "./xRequest.js";
import xResponse from "./xResponse.js";
import xURL from "./xURL.js";

/**
 * The xHttpEvent Mixin
 */
export default class HttpEvent {

    /**
     * Initializes a new HttpEvent instance.
     * 
     * @param Request       _request 
     * @param Object        _detail
     * @param Function      _sessionFactory
     * @param Function      _storageFactory
     */
    constructor(_request, _detail, _sessionFactory, _storageFactory) {
        this._request = _request;
        this._detail = _detail || {};
        this._sessionFactory = _sessionFactory;
        this._storageFactory = _storageFactory;
        // -------
        this.Request = xRequest;
        this.Response = xResponse;
        this.URL = xURL;
        // -------
        this.port = {
            listeners: [],
            post(message) { 
                const promises = this.listeners.map(listener => listener(message))
                    .filter(returnValue => returnValue instanceof Promise);
                if (process.length) return Promise.all(promises);
            },
            listen(listener) { this.listeners.push(listener); },
        }
    }

    // url
    get url() {
        if (!this._url) {
            this._url = new this.URL(this._request.url);
        }
        return this._url;
    }

    // request
    get request() {
        return this._request;
    }

    // detail
    get detail() {
        return this._detail;
    }

    // Session
    get session() {
        if (!this._session) {
            this._session = this.sessionFactory();
        }
        return this._session;
    }

    // Storage
    get storage() {
        if (!this._storage) {
            this._storage = this.storageFactory();
        }
        return this._storage;
    }

    // Session factory
    sessionFactory(...args) {
        return this._sessionFactory(...args);
    }
    
    // storage factory
    storageFactory(...args) {
        return this._storageFactory(...args);
    }

    // Redirect Response
    redirect(url, code = 302) {
        return new this.Response(null, { status: code, headers: { Location: url } });
    }

    // "with()"
    with(url, init = {}) {
        let request;
        if (url instanceof Request) {
            request = !_isEmpty(init) ? new xRequest(url, init) : url;
        } else {
            url = new this.URL(url, this.url.origin);
            request = new xRequest(url, this._request);
            request = new xRequest(request, { ...init, referrer: this.request.url });
        }            
        return new HttpEvent(request, this.detail, this._sessionFactory, this.storageFactory);
    }

}