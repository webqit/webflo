
/**
 * @imports
 */
import { _isEmpty, _isUndefined } from '@webqit/util/js/index.js';
import _MessageStream, { encodeBody } from './_MessageStream.js';
import _ResponseHeaders from './_ResponseHeaders.js';

/**
 * The _Response Mixin
 */
const _Response = globals => class extends _MessageStream(globals.Response, _ResponseHeaders(globals.Headers), globals.FormData) {

    // construct
    constructor(body = null, init = {}) {
        var _proxy = {}, _meta = {}, _typedDataCache = {};
        if (arguments.length) {
            _typedDataCache = encodeBody(body, globals);
            body = _typedDataCache.body;
        }
        // Init can contain "already-parsed request content"
        if (('_proxy' in init) || ('meta' in init)) {
            init = { ...init };
            if (('_proxy' in init)) {
                _proxy = init._proxy;
                delete init._proxy;
            }
            if (('meta' in init)) {
                _meta = init.meta;
                delete init.meta;
            }
        }
        if (!_isEmpty(init)) {
            super(body, init);
        } else {
            super(body);
        }
        this._proxy = _proxy;
        this._meta = _meta;
        this._typedDataCache = _typedDataCache;
        if (this._typedDataCache.headers) {
            this.headers.json(this._typedDataCache.headers);
        }
    }

    get ok() {
        return 'ok' in this._proxy ? this._proxy.ok : super.ok;
    }

    get redirected() {
        return 'redirected' in this._proxy ? this._proxy.redirected : super.redirected;
    }

};

export default _Response;