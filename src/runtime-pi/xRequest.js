
/**
 * @imports
 */
import { formatMessage } from './util-http.js';
import mxHttpMessage from './xxHttpMessage.js';
import xRequestHeaders from './xRequestHeaders.js';

/**
 * The xRequest Mixin
 */
export default class xRequest extends mxHttpMessage(Request, xRequestHeaders) {
        
    constructor(input, init = {}) {
        let meta = {};
        if ((input instanceof Request)) {
            // On method change...
            if (init.method && input.method !== init.method.toUpperCase() && [ 'GET', 'HEAD' ].includes(init.method.toUpperCase())) {
                // Body must not be inherited.
                input = input.url;
                init = { ...init };
                // We should now simply copy attributes
                [ 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity' ].forEach(attr => {
                    if (!(attr in init)) { init[attr] = input[attr]; }
                });
            }
        }
        let isNavigateMode;
        if (!(init instanceof Request)) {
            // Init can contain "already-parsed request content"
            if (('body' in init) && !(init.headers instanceof Headers)) {
                const [ body, headers, type ] = formatMessage(init.body);
                meta = { type, body: init.body };
                init = { ...init, body, headers: { ...headers, ...(init.headers || {}), } };
            }
            if (init.mode === 'navigate') {
                isNavigateMode = true;
                init = { ...init };
                delete init.mode;
            }
        }
        // ---------------
        super(input, init, meta);
        // ---------------
        if (isNavigateMode) {
            this.attrs.mode = 'navigate';
        }
    }

    get mode() {
        return 'mode' in this.attrs ? this.attrs.mode : super.mode;
    }

    static compat(request) {
        if (request instanceof this) return request;
        if (request instanceof Request) {
            return Object.setPrototypeOf(request, new this);
        }
    }

    static rip(request) {
        const requestInit = [
            'method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
        ].reduce((init, prop) => ({ [prop]: request[prop], ...init }), {});
        if (!['GET', 'HEAD'].includes(request.method)) {
            requestInit.body = request.body;
        }
        return [ request.url, requestInit ];
    }

}