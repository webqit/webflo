import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import xURL from "./xURL.js";

export class HttpEvent {

    static create(parentEvent, init = {}) {
        return new this(parentEvent, init);
    }

    #parentEvent;
    #init;
    #url;

    constructor(parentEvent, init = {}) {
        this.#parentEvent = parentEvent;
        this.#init = init;
        this.#url = new xURL(init.url || init.request.url);
    }

    get url() { return this.#url; }

    get request() { return this.#init.request; }

    get detail() { return this.#init.detail; }

    get cookies() { return this.#init.cookies; }

    get session() { return this.#init.session; }

    get user() { return this.#init.user; }

    get client() { return this.#init.client; }

    #requestCloneCallback;
    set onRequestClone(callback) {
        this.#requestCloneCallback = callback;
    }

    #responseHandler;
    set onRespondWith(callback) {
        this.#responseHandler = callback;
    }

    get onRespondWith() {
        return this.#responseHandler;
    }

    clone() {
        const request = this.#requestCloneCallback?.() || this.request;
        const init = { ...this.#init, request };
        const instance = this.constructor.create(this.#parentEvent, init);
        instance.#requestCloneCallback = this.#requestCloneCallback;
        return instance;
    }

    waitUntil(promise) {
        if (this.#parentEvent) {
            this.#parentEvent.waitUntil(promise);
        }
    }

    #response = null;
    get response() { return this.#response; }

    async respondWith(response) {
        this.#response = response;
        if (this.#responseHandler) {
            await this.#responseHandler(this.#response);
        } else if (this.#parentEvent) {
            await this.#parentEvent.respondWith(this.#response);
        }
    }

    async defer() {
        await this.respondWith(new Response(null, { status: 202/*Accepted*/ }));
    }

    deferred() {
        return this.#response?.status === 202;
    }

    async redirect(url, status = 302) {
        await this.respondWith(new Response(null, { status, headers: {
            Location: url
        } }));
    }

    async redirectWith(url, data, ...args) {
        if (!_isObject(data)) {
            throw new Error('Data must be a JSON object');
        }
        const messageID = (0 | Math.random() * 9e6).toString(36);
        const $url = new URL(url, this.request.url);
        $url.searchParams.set('redirect-message', messageID);
        this.session.set(`redirect-message:${messageID}`, data);
        await this.redirect($url, ...args);
    }

    redirected() {
        return [301, 302, 303, 307, 308].includes(this.#response?.status);
    }

    async stream(callback, { interval = 3000, maxClock = 30, crossNavigation = false } = {}) {
        return new Promise((res) => {
            const state = { connected: false, navigatedAway: false };
            const start = () => {
                const poll = async (maxClock) => {
                    await new Promise(($res) => setTimeout($res, interval));
                    if (maxClock === 0 || !state.connected || state.navigatedAway) {
                        res(callback());
                        return;
                    }
                    await callback(async (response, endOfStream = false) => {
                        if (endOfStream) {
                            res(response);
                        } else {
                            await this.client.postMessage(response, { messageType: 'response' });
                        }
                    });                    
                    poll(typeof maxClock === 'number' && maxClock > 0 ? --maxClock : maxClock);
                };
                poll(maxClock);
            };
            // Life cycle management
            this.client.on('connected', () => {
                state.connected = true;
                start();
            });
            this.client.on('empty', () => {
                state.connected = false;
            });
            this.client.handleMessages('navigation', (e) => {
                if (!crossNavigation
                || (crossNavigation === -1 && e.data.pathname === this.url.pathname)
                || (typeof crossNavigation === 'function' && !crossNavigation(e.data))) {
                    state.navigatedAway = true;
                }
            });
            setTimeout(() => {
                if (!state.connected) {
                    res();
                }
            }, 30000/*30sec*/);
        });
    }

    async with(url, init = {}) {
        if (!this.request) {
            return new HttpEvent(this, { ...this.#init, url });
        }
        let request, _;
        if (url instanceof Request) {
            if (init instanceof Request) { ({ url: _, ...init } = await Request.copy(init)); }
            request = !_isEmpty(init) ? new Request(url, init) : url;
        } else {
            url = new xURL(url, this.#url.origin);
            init = await Request.copy(this.request, init);
            request = new Request(url, { ...init, referrer: this.request.url });
        }            
        return new HttpEvent(this, { ...this.#init, request });
    }
}