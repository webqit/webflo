
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
            if (init.headers) { init = { ...init, headers: new Headers(init.headers) }; }
            super(input, init);
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
            Headers.compat(super.headers);
            return super.headers;
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
        jsonfy(force = false) {
            if (!this.bodyAttrs.jsonfied || force) {
                this.bodyAttrs.jsonfied = new Promise(async (resolve, reject) => {
                    var messageInstance = this, jsonfied, contentType = messageInstance.headers.get('content-type') || '';
                    var type = contentType === 'application/json' || this.bodyAttrs.json ? 'json' : (
                        contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/form-data') || this.bodyAttrs.formData ? 'formData' : (
                            contentType === 'text/plain' ? 'plain' : 'other'
                        )
                    );
                    try {
                        if (type === 'formData') {
                            jsonfied = (await messageInstance.formData()).json();
                        } else {
                            jsonfied = type === 'json' ? await messageInstance.json() : (
                                type === 'plain' ? await messageInstance.text() : messageInstance.body
                            );
                        }
                        resolve(jsonfied);
                    } catch(e) {
                        reject(e);
                    }
                });
            }
            return this.bodyAttrs.jsonfied;
        }

    };
    // ----------
    HttpMessage.Headers = Headers;
    // ----------
    return HttpMessage;
}

export default xHttpMessage;
export function encodeBody(body, FormData, Blob) {
    const detailsObj = { body, input: body };
    const encodeFormData = (detailsObj, formData) => {
        if (FormData.encode) {
            let [ body, headers ] = FormData.encode(formData);
            detailsObj.body = body;
            detailsObj.headers = headers;
            return;
        }
        detailsObj.body = formData;
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
                contentLength: (new Blob([ detailsObj.body ])).size, // Buffer.byteLength(detailsObj.body, 'utf8') isn't cross-environment
            };
        }
        detailsObj.jsonfied = body;
    }
    return detailsObj;
}
