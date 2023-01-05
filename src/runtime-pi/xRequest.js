
/**
 * @imports
 */
import mxHttpMessage from './xxHttpMessage.js';
import xRequestHeaders from './xRequestHeaders.js';
import { formatMessage } from './util-http.js';

/**
 * The xRequest Mixin
 */
export default class xRequest extends mxHttpMessage(Request, xRequestHeaders) {
        
    constructor(input, init = {}, meta = {}) {
        if (!(init instanceof Request) && 'body' in init) {
            const [ body, headers, type ] = formatMessage(init);
            meta = { ...meta, type, body: init.body };
            init = { ...init, body, headers };
        }
        super(input, init, meta);
    }

    static compat(request) {
        if (request instanceof this) return request;
        if (request instanceof Request) {
            return Object.setPrototypeOf(request, new this);
        }
    }

}