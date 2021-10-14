
/**
 * @imports
 */
import _MessageStream, { encodeBody } from './_MessageStream.js';
import _ResponseHeaders from './_ResponseHeaders.js';

/**
 * The _Response Mixin
 */
const _Response = globals => class extends _MessageStream(globals.Response, _ResponseHeaders(globals.Headers)) {

    // construct
    constructor(body, init = {}) {
        var _meta = {}, _typedDataCache = {};
        if (arguments.length) {
            _typedDataCache = encodeBody(body, globals);
            arguments[0] = _typedDataCache.body;
        }
        if (('meta' in init)) {
            init = { ...init };
            _meta = init.meta;
            delete init.meta;
            arguments[1] = init;
        }
        super(...arguments);
        this._typedDataCache = _typedDataCache;
        if (this._typedDataCache.headers) {
            this.headers.json(this._typedDataCache.headers, false);
        }
        this._meta = _meta;
    }

};

export default _Response;