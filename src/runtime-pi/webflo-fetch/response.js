
import { _isObject } from '@webqit/util/js/index.js';
import { parseHttpMessage, renderHttpMessageInit } from './message.js';
import { MessagingOverBroadcast } from '../webflo-messaging/MessagingOverBroadcast.js';
import { MessagingOverSocket } from '../webflo-messaging/MessagingOverSocket.js';
import { WebfloMessagingAPI } from '../webflo-messaging/WebfloMessagingAPI.js';
import { _wq } from '../../util.js';

export function createBackgroundMessagingPort(url) {
    const [proto, portID] = url.split(':');
    if (proto === 'channel') {
        return new MessagingOverBroadcast(null, portID, { honourDoneMutationFlags: true });
    }
    if (proto !== 'ws') {
        throw new Error(`Unknown background messaging protocol: ${proto}`);
    }
    return new MessagingOverSocket(null, portID, { honourDoneMutationFlags: true });
}

export function backgroundMessagingPort() {
    const responseMeta = _wq(this, 'meta');
    if (!responseMeta.has('backgroundMessagingPort')) {
        const value = this.headers.get('X-Background-Messaging-Port')?.trim();
        if (value) {
            responseMeta.set('backgroundMessagingPort', createBackgroundMessagingPort(value));
        }
    } else if (typeof responseMeta.get('backgroundMessagingPort') === 'function') {
        const backgroundMessagingPort = responseMeta.get('backgroundMessagingPort').call(this);
        if (!(backgroundMessagingPort instanceof WebfloMessagingAPI)) {
            throw new Error('backgroundMessagingPort callbacks must return a WebfloMessagingAPI.');
        }
        responseMeta.set('backgroundMessagingPort', backgroundMessagingPort);
    }
    return responseMeta.get('backgroundMessagingPort');
}

const { clone: cloneMethod } = Response.prototype;
const statusAccessor = Object.getOwnPropertyDescriptor(Response.prototype, 'status');
const responseMethods = {
    status: { get: function () { return _wq(this, 'meta').get('status') || statusAccessor.get.call(this); } },
    carry: { get: function () { return _wq(this, 'meta').get('carry'); } },
    clone: {
        value: function (init = {}) {
            const clone = cloneMethod.call(this, init);
            const responseMeta = _wq(this, 'meta');
            _wq(clone).set('meta', responseMeta);
            return clone;
        }
    },
    isLive: {
        value: function () {
            let liveLevel = (this.headers.get('X-Background-Messaging-Port')?.trim() || _wq(this, 'meta').has('backgroundMessagingPort')) && 1 || 0;
            liveLevel += this.headers.get('X-Live-Response-Message-ID')?.trim() && 1 || 0;
            return liveLevel;
        }
    },
    backgroundMessagingPort: {
        get: function () {
            return backgroundMessagingPort.call(this);
        }
    },
    parse: {
        value: async function () {
            return await parseHttpMessage(this);
        }
    }
};

const { json: jsonMethod } = Response;
const staticResponseMethods = {
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
            const instance = jsonMethod(data, options);
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
    },
    notFound: {
        value: function () {
            return new this(null, { status: 404/*Not Found*/ });
        }
    },
    accepted: {
        value: function () {
            return new this(null, { status: 202/*Accepted*/ });
        }
    },
    defer: {
        value: function () {
            return this.accepted();
        }
    },
};

Object.defineProperties(Response.prototype, responseMethods);
Object.defineProperties(Response, staticResponseMethods);
