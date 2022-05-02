
/**
 * @imports
 */
import xHttpMessage, { encodeBody } from './xHttpMessage.js';

/**
 * The xRequest Mixin
 */
const xRequest = (whatwagRequest, Headers, FormData, Blob) => class extends xHttpMessage(whatwagRequest, Headers, FormData) {
        
    constructor(input, init = {}) {
        init = { ...init };
        let bodyAttrs = {};
        if ((input instanceof whatwagRequest)) {
            // On method change...
            if (init.method && input.method !== init.method.toUpperCase() && [ 'GET', 'HEAD' ].includes(init.method.toUpperCase())) {
                // Body must not be inherited.
                input = input.url;
                // We should now simply copy attributes
                [ 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity' ].forEach(attr => {
                    if (!(attr in init)) {
                        init[attr] = input[attr];
                    }
                });
            } else {
                // Inherit bodyAttrs
                bodyAttrs = input.bodyAttrs || {};
            }
        }
        // Init can contain "already-parsed request content"
        if (('body' in init)) {
            bodyAttrs = encodeBody(init.body, FormData, Blob);
            init.body = bodyAttrs.body;
        }
        let isNavigateMode;
        if (init.mode === 'navigate') {
            isNavigateMode = true;
            init = { ...init };
            delete init.mode;
        }
        super(input, init, bodyAttrs);
        if (isNavigateMode) {
            // Through the backdoor
            this.attrs.mode = 'navigate';
        }
    }

    get mode() {
        return 'mode' in this.attrs ? this.attrs.mode : super.mode;
    }

    get cache() {
        return 'cache' in this.attrs ? this.attrs.cache : super.cache;
    }

    get destination() {
        return 'destination' in this.attrs ? this.attrs.destination : super.destination;
    }

    get referrer() {
        return 'referrer' in this.attrs ? this.attrs.referrer : super.referrer;
    }

};

export default xRequest;