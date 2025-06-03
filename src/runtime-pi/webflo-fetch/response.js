
import { _isObject } from '@webqit/util/js/index.js';
import { parseHttpMessage, renderHttpMessageInit } from './message.js';
import { MessagingOverSocket } from '../webflo-messaging/MessagingOverSocket.js';
import { meta } from './util.js';

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
    if (!this[meta].backgroundMessagingPort) {
        const value = this.headers.get('X-Background-Messaging-Port')?.trim();
        if (value) {
            this[meta].backgroundMessagingPort = createBackgroundMessagingPort(value);
        }
    } else if (typeof this[meta].backgroundMessagingPort === 'function') {
        const backgroundMessagingPort = this[meta].backgroundMessagingPort.call(this);
        if (!(backgroundMessagingPort instanceof MessagePort)) {
            throw new Error('backgroundMessagingPort callbacks must return a MessagePort instance.');
        }
        this[meta].backgroundMessagingPort = backgroundMessagingPort;
    }
    return this[meta].backgroundMessagingPort;
}

const { clone: cloneMethod } = Response.prototype;
const statusAccessor = Object.getOwnPropertyDescriptor(Response.prototype, 'status');
const responseMethods = {
    [meta]: { get: function () { if (!this._meta) this._meta = {}; return this._meta; } },
    status: { get: function () { return this[meta].status || statusAccessor.get.call(this); } },
    carry: { get: function () { return this[meta].carry; } },
    clone: {
        value: function (init = {}) {
            const clonedResponse = cloneMethod.call(this, init);
            Object.assign(clonedResponse[meta], this[meta]);
            return clonedResponse;
        }
    },
    backgroundMessagingPort: {
        get: function() {
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
    create: {
        value: function (body, init = {}) {
            if (body instanceof Response) return body;
            let $type, $body = body;
            if (body || body === 0) {
                let headers;
                ({ body, headers, $type } = renderHttpMessageInit({ body, headers: init.headers }));
                init = { ...init, headers };
            }
            const instance = new Response(body, init);
            instance[meta].body = $body;
            instance[meta].type = $type;
            return instance;
        }
    },
    json: {
        value: function (data, options = {}) {
            const response = jsonMethod(data, options);
            response[meta].type = 'json';
            response[meta].body = data;
            return response;
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
                responseInstance[meta].carry = { request, response };
            }
            return responseInstance;
        }
    },
    notFound: {
        value: function () {
            return new this(null, { status: 404/*Not Found*/ });
        }
    },
    notModified: {
        value: function () {
            return new this(null, { status: 304/*Not Modified*/ });
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
