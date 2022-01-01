
/**
 * @imports
 */
import { _isArray, _isEmpty, _isNumber, _isObject, _isPlainArray, _isPlainObject, _isString } from '@webqit/util/js/index.js';
import { formDataType } from './_FormData.js';

/**
 * The _Request Mixin
 */
const _MessageStream = (NativeMessageStream, Headers, FormData) => {
    const MessageStream = class extends NativeMessageStream {
        
        constructor(input, init = {}) {
            var _proxy = {}, _meta = {};
            if ((('headers' in init) && !(init instanceof Headers)) || ('_proxy' in init) || ('meta' in init)) {
                init = { ...init };
                if (('headers' in init) && !(init instanceof Headers)) {
                    init.headers = new Headers(init.headers);
                }
                if (('_proxy' in init)) {
                    _proxy = init._proxy;
                    delete init._proxy;
                }
                if (('meta' in init)) {
                    _meta = init.meta;
                    delete init.meta;
                }
                arguments[1] = init;
            }
            super(...arguments);
            this._proxy = _proxy;
            this._meta = _meta;
        }

        clone() {
            const clone = new this.constructor(super.clone());
            clone._proxy = this._proxy;
            clone._headers = this._headers;
            clone._typedDataCache = this._typedDataCache;
            clone._meta = this._meta;
            return clone;
        }

        get url() {
            return 'url' in this._proxy ? this._proxy.url : super.url;
        }

        get headers() {
            if (!this._headers) {
                this._headers = new Headers(super.headers);
            }
            return this._headers;
        }

        get original() {
            return this._typedDataCache.original;
        }

        get originalType() {
            return this._typedDataCache.originalType;
        }

        get meta() {
            return this._meta || {};
        }

        async arrayBuffer() {
            if (this._typedDataCache.arrayBuffer) {
                return this._typedDataCache.arrayBuffer;
            }
            return super.arrayBuffer();
        }

        async blob() {
            if (this._typedDataCache.blob) {
                return this._typedDataCache.blob;
            }
            return super.blob();
        }

        async formData() {
            if (this._typedDataCache.formData) {
                return this._typedDataCache.formData;
            }
            const formData = await super.formData();
            formData.tee = FormData.prototype.tee.bind(formData);
            formData.json = FormData.prototype.json.bind(formData);
            return formData;
        }

        async json() {
            if (this._typedDataCache.json) {
                return this._typedDataCache.json;
            }
            return super.json();
        }

        async text() {
            if (this._typedDataCache.text) {
                return this._typedDataCache.text;
            }
            return super.text();
        }
                
        // Payload
        jsonBuild(force = false) {
            if (!this._typedDataCache.jsonBuild || force) {
                this._typedDataCache.jsonBuild = new Promise(async resolve => {
                    var request = this, jsonBuild, contentType = request.headers.get('content-type') || '';
                    var type = contentType === 'application/json' || this._typedDataCache.json ? 'json' : (
                        contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') || this._typedDataCache.formData || (!contentType && !['get'].includes((request.method || '').toLowerCase())) ? 'formData' : (
                            contentType === 'text/plain' ? 'plain' : 'other'
                        )
                    );
                    if (type === 'formData') {
                        jsonBuild = (await request.formData()).json();
                    } else {
                        jsonBuild = type === 'json' ? await request.json() : (
                            type === 'plain' ? await request.text() : request.body
                        );
                    }
                    resolve(jsonBuild);
                });
            }
            return this._typedDataCache.jsonBuild;
        }

    };
    // ----------
    MessageStream.Headers = Headers;
    // ----------
    return MessageStream;
}

export default _MessageStream;

export function encodeBody(body, globals) {
    const detailsObj = { body, original: body };
    if (_isString(body) || _isNumber(body)) {
        detailsObj.originalType = 'text';
        detailsObj.text = body;
        detailsObj.headers = {
            contentLength: (body + '').length,
        };
        return detailsObj;
    }
    detailsObj.originalType = formDataType(body);
    if ([ 'Blob', 'File' ].includes(detailsObj.originalType)) {
        detailsObj.blob = body;
        detailsObj.headers = {
            contentType: body.type,
            contentLength: body.size,
        };
    } else if ([ 'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer' ].includes(detailsObj.originalType)) {
        detailsObj.arrayBuffer = body;
        detailsObj.headers = {
            contentLength: body.byteLength,
        };
    } else if (detailsObj.originalType === 'FormData') {
        detailsObj.formData = body;
        encodeFormData(detailsObj, body, globals);
    } else if ((_isObject(body) && _isPlainObject(body)) || (_isArray(body) && _isPlainArray(body))) {
        // Deserialize object while detecting if multipart
        var hasBlobs, formData = new globals.FormData;
        formData.json(body, (path, value, objectType) => {
            hasBlobs = hasBlobs || objectType;
            return true;
        });
        if (hasBlobs) {
            detailsObj.formData = formData;
            encodeFormData(detailsObj, formData, globals);
        } else {
            detailsObj.json = body;
            detailsObj.body = JSON.stringify(body);
            detailsObj.headers = {
                contentType: 'application/json',
                contentLength: Buffer.byteLength(detailsObj.body, 'utf8'), // Buffer.from(string).length
            };
        }
        detailsObj.jsonBuild = body;
    }
    return detailsObj;
}

const encodeFormData = (detailsObj, formData, globals) => {
    if (!globals.FormDataEncoder || !globals.ReadableStream) return;
    const encoder = new globals.FormDataEncoder(formData);
    detailsObj.body = globals.ReadableStream.from(encoder.encode());
    detailsObj.headers = encoder.headers;
};