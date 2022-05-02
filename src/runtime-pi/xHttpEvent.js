
/**
 * @imports
 */
import { _isEmpty } from '@webqit/util/js/index.js';

/**
 * The xHttpEvent Mixin
 */
const xHttpEvent = (Request, Response, URL) => {

    const HttpEvent = class {

        /**
         * Initializes a new HttpEvent instance.
         * 
         * @param Request       _request 
         * @param Object        _detail
         * @param Object        _sessionFactory
         */
        constructor(_request, _detail, _sessionFactory) {
            this._request = _request;
            this._detail = _detail || {};
            this._sessionFactory = _sessionFactory;
            // -------
            this.Request = Request;
            this.Response = Response;
            this.URL = URL;
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
                this._session = this.sessionFactory().get();
            }
            return this._session;
        }

        // Session factory
        sessionFactory(...args) {
            return this._sessionFactory(...args);
        }

        // RDR
        retarget(url, init = {}) {
            var request;
            if (url instanceof Request) {
                if (!_isEmpty(init)) {
                    request = new Request(url, init);
                } else {
                    request = url;
                }
            } else {
                request = new Request(this._request, init);
                request.attrs.url = `${this.url.origin}${url}`;
                request.attrs.referrer = this.request.url;
            }            
            return new HttpEvent(request, this.detail);
        }

    }
    return HttpEvent;
}

export default xHttpEvent;