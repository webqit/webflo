import { _isEmpty, _isObject } from '@webqit/util/js/index.js';
import xURL from "./xURL.js";

export class HttpEvent {

    static create(parentEvent, init = {}) {
        return new this(parentEvent, init);
    }

    #parentEvent;
    #init;
    #url;
    #requestCloneCallback;

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

    set onRequestClone(callback) {
        this.#requestCloneCallback = callback;
    }

    clone() {
        const request = this.#requestCloneCallback?.() || this.request;
        const init = { ...this.#init, request };
        const instance = this.constructor.create(init);
        instance.#requestCloneCallback = this.#requestCloneCallback;
        return instance;
    }

    #response = null;
    get response() { return this.#response; }

    #responseOrigin = null;

    async #respondWith(response) {
        /*
        if (this.#response) {
            throw new Error(`Event has already been responded to! (${this.#responseOrigin})`);
        }
        */
        this.#response = response;
        /*
        if (!this.#responseOrigin) {
            const stack = new Error().stack;
            const stackLines = stack.split('\n');
            this.#responseOrigin = stackLines[3].trim();
        }
        */
        if (this.#parentEvent instanceof HttpEvent) {
            /*
            // Set responseOrigin first to prevent parent from repeating the work
            this.#parentEvent.#responseOrigin = this.#responseOrigin;
            */
            // Ensure the respondWith() method is how we propagate response
            await this.#parentEvent.respondWith(this.#response);
        } else {
            // The callback passed at root
            await this.#parentEvent?.(response);
        }
    }

    async respondWith(response) {
        await this.#respondWith(response);
    }

    async defer() {
        await this.#respondWith(new Response(null, { status: 202/*Accepted*/ }));
    }

    deferred() {
        return this.#response?.status === 202;
    }

    async redirect(url, status = 302) {
        await this.#respondWith(new Response(null, { status, headers: {
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

    async with(url, init = {}) {
        if (!this.request) {
            return new HttpEvent(this, { ...this.#init, url  });
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
        return new HttpEvent(this, { ...this.#init, request  });
    }
}