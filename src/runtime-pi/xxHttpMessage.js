
/**
 * @imports
 */
import { _isTypeObject } from '@webqit/util/js/index.js';
import xFormData from './xFormData.js';

/**
 * The _Request Mixin
 */
const xxHttpMessage = (whatwagHttpMessage, xHeaders) => {
    const HttpMessage = class extends whatwagHttpMessage {
        
        constructor(input, init, meta) {
            // ------------
            if (init.headers) { init = { ...init, headers: new xHeaders(init.headers) }; }
            super(input, init);
            if (meta.headers) { this.headers.json(meta.headers); }
            // ------------
            let attrs = {};
            Object.defineProperty(this, '_attrs', { get: () => attrs });
            Object.defineProperty(this, 'meta', { get: () => meta });
        }

        get attrs() {
            return this._attrs || {};
        }

        clone() {
            return new this.constructor(super.clone());
        }

        get headers() {
            xHeaders.compat(super.headers);
            return super.headers;
        }

        get url() {
            return 'url' in this.attrs ? this.attrs.url : super.url;
        }

        async arrayBuffer() {
            if (this.meta.type === 'ArrayBuffer') { return this.meta.body; }
            return super.arrayBuffer();
        }

        async blob() {
            if (['Blob', 'File'].includes(this.meta.type)) { return this.meta.body; }
            return super.blob();
        }

        async formData() {
            let formData;
            if (this.meta.type === 'FormData' && this.meta.body instanceof FormData) {
                formData = this.meta.body;
            } else { formData = await super.formData(); }
            if (formData) { formData = xFormData.compat(formData); }
            return formData;
        }

        async json() {
            if (this.meta.type === 'json' && _isTypeObject(this.meta.body)) { return this.meta.body; }
            return super.json();
        }

        async text() {
            if (this.meta.type === 'json' && !_isTypeObject(this.meta.body)) { return this.meta.body; }
            return super.text();
        }
                
        // Resolve
        jsonfy(force = false) {
            if (!this.meta.jsonfied || force) {
                this.meta.jsonfied = new Promise(async (resolve, reject) => {
                    let jsonfied;
                    let contentType = this.headers.get('Content-Type') || '';
                    try {
                        if (contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/form-data')) {
                            const formData = await this.formData();
                            jsonfied = await formData?.json();
                        } else if (contentType === 'application/json') {
                            jsonfied = await this.json();
                        } else if (contentType === 'text/plain') {
                            jsonfied = await this.text();
                        }
                        resolve(jsonfied);
                    } catch(e) {
                        reject(e);
                    }
                });
            }
            return this.meta.jsonfied;
        }

    };
    // ----------
    HttpMessage.Headers = xHeaders;
    // ----------
    return HttpMessage;
}

export default xxHttpMessage;