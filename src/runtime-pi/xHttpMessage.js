
/**
 * @imports
 */
import { _isArray, _isEmpty, _isNumber, _isObject, _isPlainArray, _isPlainObject, _isString } from '@webqit/util/js/index.js';
import { formDataType } from './xFormData.js';

/**
 * The _Request Mixin
 */
const xHttpMessage = (whatwagHttpMessage, Headers, FormData) => {
    const HttpMessage = class extends whatwagHttpMessage {
        
        constructor(input, init, bodyAttrs) {
            if (('headers' in init) && !(init.headers instanceof Headers)) {
                init = { ...init };
                init.headers = new Headers(init.headers);
                arguments[1] = init;
            }
            if (_isEmpty(init)) {
                super(input);
            } else {
                super(input, init);
            }
            this._headers = init.headers;
            if (bodyAttrs.headers) {
                this.headers.json(bodyAttrs.headers);
            }
            let attrs = {};
            Object.defineProperty(this, 'attrs', { get: () => attrs });
            Object.defineProperty(this, 'bodyAttrs', { get: () => bodyAttrs });
        }

        clone() {
            return new this.constructor(super.clone());
        }

        get headers() {
            if (!this._headers) {
                this._headers = new Headers(super.headers);
            }
            return this._headers;
        }

        get attrs() {
            return this.attrs;
        }

        get url() {
            return 'url' in this.attrs ? this.attrs.url : super.url;
        }

        async arrayBuffer() {
            if (this.bodyAttrs.arrayBuffer) {
                return this.bodyAttrs.arrayBuffer;
            }
            return super.arrayBuffer();
        }

        async blob() {
            if (this.bodyAttrs.blob) {
                return this.bodyAttrs.blob;
            }
            return super.blob();
        }

        async formData() {
            if (this.bodyAttrs.formData) {
                return this.bodyAttrs.formData;
            }
            const formData = await super.formData();
            formData.tee = FormData.prototype.tee.bind(formData);
            formData.json = FormData.prototype.json.bind(formData);
            return formData;
        }

        async json() {
            if (this.bodyAttrs.json) {
                return this.bodyAttrs.json;
            }
            return super.json();
        }

        async text() {
            if (this.bodyAttrs.text) {
                return this.bodyAttrs.text;
            }
            return super.text();
        }
                
        // Resolve
        resolve(force = false) {
            if (!this.bodyAttrs.resolved || force) {
                this.bodyAttrs.resolved = new Promise(async (resolve, reject) => {
                    var messageInstance = this, resolved, contentType = messageInstance.headers.get('content-type') || '';
                    var type = contentType === 'application/json' || this.bodyAttrs.json ? 'json' : (
                        contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') || this.bodyAttrs.formData ? 'formData' : (
                            contentType === 'text/plain' ? 'plain' : 'other'
                        )
                    );
                    try {
                        if (type === 'formData') {
                            resolved = (await messageInstance.formData()).json();
                        } else {
                            resolved = type === 'json' ? await messageInstance.json() : (
                                type === 'plain' ? await messageInstance.text() : messageInstance.body
                            );
                        }
                        resolve(resolved);
                    } catch(e) {
                        reject(e);
                    }
                });
            }
            return this.bodyAttrs.resolved;
        }

    };
    // ----------
    HttpMessage.Headers = Headers;
    // ----------
    return HttpMessage;
}

export default xHttpMessage;
export function encodeBody(body, FormData) {
    const detailsObj = { body, input: body };
    const encodeFormData = (detailsObj, formData) => {
        if (!FormData.encode) return;
        let [ body, headers ] = FormData.encode(formData);
        detailsObj.body = body;
        detailsObj.headers = headers;
    }
    if (_isString(body) || _isNumber(body)) {
        detailsObj.inputType = 'text';
        detailsObj.text = body;
        detailsObj.headers = {
            contentLength: (body + '').length,
        };
        return detailsObj;
    }
    detailsObj.inputType = formDataType(body);
    if ([ 'Blob', 'File' ].includes(detailsObj.inputType)) {
        detailsObj.blob = body;
        detailsObj.headers = {
            contentType: body.type,
            contentLength: body.size,
        };
    } else if ([ 'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer' ].includes(detailsObj.inputType)) {
        detailsObj.arrayBuffer = body;
        detailsObj.headers = {
            contentLength: body.byteLength,
        };
    } else if (detailsObj.inputType === 'FormData') {
        detailsObj.formData = body;
        encodeFormData(detailsObj, body);
    } else if ((_isObject(body) && _isPlainObject(body)) || (_isArray(body) && _isPlainArray(body))) {
        detailsObj.inputType = 'object';
        // Deserialize object while detecting if multipart
        var hasBlobs, formData = new FormData;
        formData.json(body, (path, value, objectType) => {
            hasBlobs = hasBlobs || objectType;
            return true;
        });
        if (hasBlobs) {
            detailsObj.formData = formData;
            encodeFormData(detailsObj, formData);
        } else {
            detailsObj.json = body;
            detailsObj.body = JSON.stringify(body);
            detailsObj.headers = {
                contentType: 'application/json',
                contentLength: Buffer.byteLength(detailsObj.body, 'utf8'), // Buffer.from(string).length
            };
        }
        detailsObj.resolved = body;
    }
    return detailsObj;
}
