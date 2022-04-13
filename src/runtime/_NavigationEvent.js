
/**
 * @imports
 */
import _URL from './_URL.js';
import _Request from "./_Request.js";
import _Response from "./_Response.js";
import _FormData from "./_FormData.js";
import { _isEmpty } from '@webqit/util/js/index.js';

/**
 * The _NavigationEvent Mixin
 */
const _NavigationEvent = globals => {
    // ----------
    const URL = _URL(globals.URL);
    const Request = _Request(globals);
    const Response = _Response(globals);
    // ----------
    const NavigationEvent = class {

        /**
         * Initializes a new NavigationEvent instance.
         * 
         * @param Request       _request 
         * @param Object        _session 
         * @param Function      _sessionFactory 
         */
        constructor(_request, _session = {}, _sessionFactory = null) {
            this._request = _request;
            this._session = _session;
            this.sessionFactory = _sessionFactory;
            // -------
            this.URL = URL;
            // -------
            this.Request = Request;
            this.Request.sourceEvent = this; 
            // -------
            this.Response = Response;
            this.Response.sourceEvent = this; 
            // -------
            this.globals = globals;
        }

        // url
        get url() {
            if (!this._url) {
                this._url = new URL(this._request.url);
            }
            return this._url;
        }

        // request
        get request() {
            return this._request;
        }

        // session
        get session() {
            return this._session;
        }

        // RDR
        retarget(url, init = {}) {
            var request;
            if (url instanceof NavigationEvent.Request) {
                if (!_isEmpty(init)) {
                    request = new NavigationEvent.Request(url, init);
                } else {
                    request = url;
                }
            } else {
                init = { _proxy: {}, ...init };
                init._proxy.url = `${this.url.origin}${url}`;
                init._proxy.referrer = this.request.url;
                request = new NavigationEvent.Request(this._request, init);
            }            
            return new NavigationEvent(request, this._session, this.sessionFactory);
        }

    }
    // ----------
    NavigationEvent.URL = URL;
    NavigationEvent.Request = Request;
    NavigationEvent.Response = Response;
    NavigationEvent.globals = globals;
    // ----------
    return NavigationEvent;
}

export default _NavigationEvent;