
/**
 * @imports
 */
import { formatMessage } from './util-http.js';
import mxHttpMessage from './xxHttpMessage.js';
import xResponseHeaders from './xResponseHeaders.js';

/**
 * The xResponse Mixin
 */
export default class xResponse extends mxHttpMessage(Response, xResponseHeaders) {

    // construct
    constructor(body = undefined, init = {}) {
        let meta = {}, isResponseInput;
        if (arguments.length) {
            if (body instanceof Response) {
                isResponseInput = body;
                // Inherit init
                init = { status: body.status, statusText: body.statusText, headers: body.headers, ...init };
                if (body.status === 0) delete init.status;
                // Inherit meta and body
                meta = body.meta || {};
                body = body.body;
            } else if (!(init.headers instanceof Headers)) {
                let headers, type, _body = body;
                [ body, headers, type ] = formatMessage(body);
                meta = { type, body: _body };
                init = { ...init, headers: { ...headers, ...(init.headers || {}), } };
            }
        }
        // ---------------
        super(body, init, meta);
        // ---------------
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
        if (response instanceof Response) {
            return Object.setPrototypeOf(response, new this);
        }
    }

}