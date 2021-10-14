
/**
 * @imports
 */
import { _isArray, _isEmpty, _isNumber, _isObject, _isPlainArray, _isPlainObject, _isString, _isTypeObject, _getType } from '@webqit/util/js/index.js';
import { wwwFormSet, wwwFormPathSerializeCallback } from './util.js';

/**
 * The _Request Mixin
 */
const _MessageStream = (NativeMessageStream, Headers) => {
    const MessageStream = class extends NativeMessageStream {
        
        constructor(input, init = {}) {
            if ('headers' in init && !(init instanceof Headers)) {
                arguments[1] = { ...init, headers: new Headers(init.headers) };
            }
            super(...arguments);
        }

        clone() {
            const clone = new this.constructor(super.clone());
            clone._url = this._url;
            clone._headers = this._headers;
            clone._typedDataCache = this._typedDataCache;
            clone._meta = this._meta;
            return clone;
        }

        get url() {
            return this._url || super.url;
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
            return super.formData();
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
                    var request = this;
                    var jsonBuild = [ {}, {} ];
                    var contentType = request.headers.get('content-type') || '';
                    jsonBuild.type = contentType === 'application/json' || this._typedDataCache.json ? 'json' : (
                        contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') || this._typedDataCache.formData || (!contentType && !['get'].includes(request.method.toLowerCase())) ? 'formData' : (
                            contentType === 'text/plain' ? 'plain' : 'other'));
                    if (jsonBuild.type === 'formData') {
                        const payload = await request.formData();
                        for(var [ name, value ] of payload.entries()) {
                            if (formDataType(value)) {
                                wwwFormSet(jsonBuild[1], name, value);
                            } else {
                                wwwFormSet(jsonBuild[0], name, value);
                            }
                        }
                    } else {
                        jsonBuild[0] = jsonBuild.type === 'json' ? await request.json() : await request.text();
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
            contentType: 'text/plain',
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
        detailsObj.jsonBuild = [ {}, {} ];
        const formData = new globals.FormData;
        Object.keys(body).forEach(key => {
            wwwFormPathSerializeCallback(key, body[key], (_wwwFormPath, _value) => {
                formData.append(_wwwFormPath, _value);
                wwwFormSet(_isTypeObject(_value) ? detailsObj.jsonBuild[1] : detailsObj.jsonBuild[0], _wwwFormPath, _value);
            }, value => !formDataType(value));
        });
        // Now decide the appropriate body type
        if (_isEmpty(detailsObj.jsonBuild[1])) {
            detailsObj.jsonBuild.type = 'json';
            detailsObj.json = detailsObj.jsonBuild[0];
            detailsObj.body = JSON.stringify(detailsObj.jsonBuild[0]);
            detailsObj.headers = {
                contentType: 'application/json',
                contentLength: body.length,
            };
        } else {
            detailsObj.jsonBuild.type = 'formData';
            detailsObj.formData = formData;
            detailsObj.body = formData;
            encodeFormData(detailsObj, formData, globals);
        }
    }
    return detailsObj;
}

const formDataType = (value, list = null) => {
    if (!_isTypeObject(value)) {
        return;
    }
    const toStringTag = value[Symbol.toStringTag];
    return (list || [
        'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer', 'Blob', 'File', 'FormData', 'Stream'
    ]).reduce((_toStringTag, type) => _toStringTag || (toStringTag === type ? type : null), null);
};

const encodeFormData = (detailsObj, formData, globals) => {
    if (!globals.FormDataEncoder || !globals.ReadableStream) return;
    const encoder = new globals.FormDataEncoder(formData);
    detailsObj.body = globals.ReadableStream.from(encoder.encode());
    detailsObj.headers = encoder.headers;
};