
/**
 * @imports
 */
import xHttpMessage, { encodeBody } from './xHttpMessage.js';

/**
 * The xResponse Mixin
 */
const xResponse = (whatwagResponse, Headers, FormData, Blob) => class extends xHttpMessage(whatwagResponse, Headers, FormData) {

    // construct
    constructor(body = null, init = {}) {
        let bodyAttrs = {}, isResponseInput;
        if (arguments.length) {
            if (body instanceof whatwagResponse) {
                isResponseInput = body;
                // Inherit init
                init = { status: body.status, statusText: body.statusText, headers: body.headers, ...init };
                if (body.status === 0) delete init.status;
                // Inherit bodyAttrs and body
                bodyAttrs = body.bodyAttrs || {};
                body = body.body;
            } else {
                bodyAttrs = encodeBody(body, FormData, Blob);
                body = bodyAttrs.body;
            }
        }
        super(body, init, bodyAttrs);
        if (isResponseInput) {
            // Through the backdoor
            this.attrs.url = isResponseInput.url;
            this.attrs.ok = isResponseInput.ok;
            this.attrs.status = isResponseInput.status; // In case it was earlier deleted
            this.attrs.type = isResponseInput.type;
            this.attrs.redirected = isResponseInput.redirected;
        }
    }

    get ok() {
        return 'ok' in this.attrs ? this.attrs.ok : super.ok;
    }

    get status() {
        return 'status' in this.attrs ? this.attrs.status : super.status;
    }

    get statusText() {
        return 'statusText' in this.attrs ? this.attrs.statusText : super.statusText;
    }

    get type() {
        return 'type' in this.attrs ? this.attrs.type : super.type;
    }

    get redirected() {
        return 'redirected' in this.attrs ? this.attrs.redirected : super.redirected;
    }

    static compat(response) {
        if (response instanceof this) return response;
        if (response instanceof whatwagResponse) {
            return Object.setPrototypeOf(response, new this);
        }
    }

};

export default xResponse;