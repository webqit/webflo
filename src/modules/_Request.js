
/**
 * @imports
 */
import { wwwFormUnserialize } from './util.js';
import _MessageStream, { encodeBody } from './_MessageStream.js';
import _RequestHeaders from './_RequestHeaders.js';

/**
 * The _Request Mixin
 */
const _Request = globals => class extends _MessageStream(globals.Request, _RequestHeaders(globals.Headers)) {
        
    constructor(input, init = {}) {
        var _url, _meta = {}, _destination = null, _typedDataCache = {};
        if (input instanceof globals.Request) {
            // The "destination" property doesn't survive into a wrapper
            _url = input._url;
            _destination = input.destination;
            if (input._typedDataCache) {
                _typedDataCache = input._typedDataCache;
            }
        }
        // Init can contain "already-parsed request content"
        if (('body' in init) || ('url' in init) || ('meta' in init)) {
            init = { ...init };
            if (('body' in init)) {
                _typedDataCache = encodeBody(init.body, globals);
                init.body = _typedDataCache.body;
            }
            if (('url' in init)) {
                _url = init.url;
                delete init.url;
            }
            if (('meta' in init)) {
                _meta = init.meta;
                delete init.meta;
            }
            arguments[1] = init;
        }
        super(...arguments);
        this._typedDataCache = _typedDataCache;
        if (this._typedDataCache.headers) {
            this.headers.json(this._typedDataCache.headers, false);
        }
        this._url = _url;
        this._destination = _destination;
        this._meta = _meta;
    }

    get destination() {
        return this._destination;
    }

    get cookies() {
        if (!this._typedDataCache.cookies) {
            this._typedDataCache.cookies = wwwFormUnserialize(this.headers.get('cookie'), {}, ';');
        }
        return this._typedDataCache.cookies;
    }

};

export default _Request;