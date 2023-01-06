
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
        if (init instanceof Request) {

        } else if ('body' in init) {
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
        return new this(request);
    }

    static async rip(request) {
        const requestInit = [
            'method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
        ].reduce((init, prop) => ({ [prop]: request[prop], ...init }), {});
        if (!['GET', 'HEAD'].includes(request.method)) {
            requestInit.body = await request.arrayBuffer();
        }
        if (requestInit.mode === 'navigate') {
            requestInit.mode = 'cors';
        }
        return [ request.url, requestInit ];
    }

}