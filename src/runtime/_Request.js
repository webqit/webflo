
/**
 * @imports
 */
import { _isEmpty } from '@webqit/util/js/index.js';
import _MessageStream, { encodeBody } from './_MessageStream.js';
import _RequestHeaders from './_RequestHeaders.js';

/**
 * The _Request Mixin
 */
const _Request = globals => class extends _MessageStream(globals.Request, _RequestHeaders(globals.Headers), globals.FormData) {
        
    constructor(input, init = {}) {
        var _typedDataCache = {};
        if (input instanceof globals.Request) {
            init = { ...init };
            init._proxy = { ...(input._proxy || {}), ...(init._proxy || {}) };
            if (input._typedDataCache) {
                _typedDataCache = input._typedDataCache;
            }
            if (init.method && input.method !== init.method.toUpperCase() && [ 'GET', 'HEAD' ].includes(init.method.toUpperCase())) {
                // Body must not inherited. We should now simply copy attributes
                input = input.url;
                [ 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity' ].forEach(attr => {
                    if (!(attr in init)) {
                        init[attr] = input[attr];
                    }
                });
            }
        }
        // Init can contain "already-parsed request content"
        if (('body' in init)) {
            init = { ...init };
            _typedDataCache = encodeBody(init.body, globals);
            init.body = _typedDataCache.body;
        }
        if (!_isEmpty(init)) {
            super(input, init);
        } else {
            super(input);
        }
        this._typedDataCache = _typedDataCache;
        if (this._typedDataCache.headers) {
            this.headers.json(this._typedDataCache.headers);
        }
    }

    get destination() {
        return 'destination' in this._proxy ? this._proxy.destination : super.destination;
    }

    get referrer() {
        return 'referrer' in this._proxy ? this._proxy.referrer : super.referrer;
    }

};

export default _Request;