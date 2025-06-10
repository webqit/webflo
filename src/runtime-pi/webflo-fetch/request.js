import { _wq } from '../../util.js';
import { renderHttpMessageInit } from './message.js';


const { clone: cloneMethod } = Request.prototype;
const requestMethods = {
    carries: { get: function () { return new Set(_wq(this, 'meta').get('carries') || []); } },
    clone: {
        value: function (init = {}) {
            const clone = cloneMethod.call(this, init);
            const requestMeta = _wq(this, 'meta');
            _wq(clone).set('meta', requestMeta);
            return clone;
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
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', $$body);
            responseMeta.set('type', $$type);
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
