
import { _isObject } from '@webqit/util/js/index.js';
import { parseHttpMessage, renderHttpMessageInit } from './message.js';
import { WQBroadcastChannel } from '../webflo-messaging/WQBroadcastChannel.js';
import { WQSockPort } from '../webflo-messaging/WQSockPort.js';
import { _wq } from '../../util.js';

export function responseRealtimeConnect(url) {
    const [proto, portID] = url.split(':');
    if (proto === 'br') {
        return new WQBroadcastChannel(portID);
    }
    if (proto !== 'ws') {
        throw new Error(`Unknown background messaging protocol: ${proto}`);
    }
    return new WQSockPort(portID);
}

export function responseRealtime() {
    const responseMeta = _wq(this, 'meta');
    if (!responseMeta.has('wqRealtime')) {
        const value = this.headers.get('X-Background-Messaging-Port')?.trim();
        if (value) {
            responseMeta.set('wqRealtime', responseRealtimeConnect(value));
        }
    }
    return responseMeta.get('wqRealtime');
}

const staticOriginals = { json: Response.json };
const staticExtensions = {
    from: {
        value: function (body, init = {}) {
            if (body instanceof Response) return body;
            let $type, $body = body;
            if (body || body === 0) {
                let headers;
                ({ body, headers, $type } = renderHttpMessageInit({ body, headers: init.headers }));
                init = { ...init, headers };
            }
            const instance = new Response(body, init);
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', $body);
            responseMeta.set('type', $type);
            return instance;
        }
    },
    json: {
        value: function (data, options = {}) {
            const instance = staticOriginals.json(data, options);
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', data);
            responseMeta.set('type', 'json');
            return instance;
        }
    },
    redirectWith: {
        value: function (url, { status = 302, request = null, response = null }) {
            if (typeof status !== 'string') {
                throw new Error('Redirect code must be an object!');
            }
            if (request && !_isObject(request) || response && !_isObject(response)) {
                throw new Error('Carries (redirect requests and responses) must be an object!');
            }
            const responseInstance = this.redirect(url, status);
            if (request || response) {
                const responseMeta = _wq(responseInstance, 'meta');
                responseMeta.set('carry', { request, response });
            }
            return responseInstance;
        }
    }
};

const prototypeOriginals = {
    clone: Response.prototype.clone,
    status: Object.getOwnPropertyDescriptor(Response.prototype, 'status'),
};
const prototypeExtensions = {
    status: { get: function () { return _wq(this, 'meta').get('status') || prototypeOriginals.status.get.call(this); } },
    carry: { get: function () { return _wq(this, 'meta').get('carry'); } },
    clone: {
        value: function (init = {}) {
            const clone = prototypeOriginals.clone.call(this, init);
            const responseMeta = _wq(this, 'meta');
            _wq(clone).set('meta', responseMeta);
            return clone;
        }
    },
    isLive: {
        value: function () {
            let liveLevel = (this.headers.get('X-Background-Messaging-Port')?.trim() || _wq(this, 'meta').has('wqRealtime')) && 1 || 0;
            liveLevel += this.headers.get('X-Live-Response-Message-ID')?.trim() && 1 || 0;
            return liveLevel;
        }
    },
    wqRealtime: {
        get: function () {
            return responseRealtime.call(this);
        }
    },
    parse: {
        value: async function () {
            return await parseHttpMessage(this);
        }
    }
};

Object.defineProperties(Response.prototype, prototypeExtensions);
Object.defineProperties(Response, staticExtensions);
