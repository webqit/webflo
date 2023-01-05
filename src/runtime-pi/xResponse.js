
/**
 * @imports
 */
import mxHttpMessage from './xxHttpMessage.js';
import xResponseHeaders from './xResponseHeaders.js';
import { formatMessage } from './util-http.js';

/**
 * The xResponse Mixin
 */
export default class xResponse extends mxHttpMessage(Response, xResponseHeaders) {

    // construct
    constructor(body = null, init = {}, meta = {}) {
        if (body || body === 0) {
            let headers, type, _body = body;
            [ body, headers, type ] = formatMessage({ body, headers: init.headers });
            meta = { ...init, type, body: _body };
            init = { ...init, headers };
        }
        super(body, init, meta);
    }

    static compat(response) {
        if (response instanceof this) return response;
        if (response instanceof Response) {
            return Object.setPrototypeOf(response, new this);
        }
    }

}