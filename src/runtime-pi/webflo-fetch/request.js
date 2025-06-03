import { renderHttpMessageInit } from './message.js';
import { meta } from './util.js';


const { clone: cloneMethod } = Request.prototype;
const requestMethods = {
    [meta]: { get: function () { if (!this._meta) this._meta = {}; return this._meta; } },
    carries: { get: function () { return new Set(this[meta].carries || []); } },
    clone: {
        value: function (init = {}) {
            const clonedRequest = cloneMethod.call(this, init);
            Object.assign(clonedRequest[meta], this[meta]);
            return clonedRequest;
        }
    },
    parse: { value: function () { return parseHttpMessage(this); } },
};

const staticRequestMethods = {
    from: {
        value: function (url, init = {}) {
            if (url instanceof Request) return url;
            let $$type, $$body = init.body;
            if ('body' in init) {
                const { body, headers, $type } = renderHttpMessageInit(init);
                init = { ...init, body, headers };
                $$type = $type;
            }
            const instance = new Request(url, init);
            instance[meta].body = $$body;
            instance[meta].type = $$type;
            return instance;
        }
    },
    copy: {
        value: async function (request, init = {}) {
            const requestInit = [
                'method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
            ].reduce(($init, prop) => (
                { ...$init, [prop]: prop in init ? init[prop] : (prop === 'headers' ? new Headers(request[prop]) : request[prop]) }
            ), {});
            if (!['GET', 'HEAD'].includes(init.method?.toUpperCase() || request.method)) {
                if ('body' in init) {
                    requestInit.body = init.body
                    if (!('headers' in init)) {
                        requestInit.headers.delete('Content-Type');
                        requestInit.headers.delete('Content-Length');
                    }
                } else {
                    requestInit.body = await request.clone().arrayBuffer();
                }
            }
            if (requestInit.mode === 'navigate') {
                requestInit.mode = 'cors';
            }
            return { url: request.url, ...requestInit };
        }
    }
};

Object.defineProperties(Request.prototype, requestMethods);
Object.defineProperties(Request, staticRequestMethods);
