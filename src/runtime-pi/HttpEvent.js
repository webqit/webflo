import { _isEmpty } from '@webqit/util/js/index.js';
import xURL from "./xURL.js";

export class HttpEvent {

    static create(parentEvent, init) {
        return new this(parentEvent, init);
    }

    #parentEvent;
    #init;
    #url;
    #requestCloneCallback;

    constructor(parentEvent, init) {
        this.#parentEvent = parentEvent;
        this.#init = init;
        this.#url = new xURL(init.request.url);
    }

    get url() { return this.#url; }

    get request() { return this.#init.request; }

    get detail() { return this.#init.detail; }

    get cookies() { return this.#init.cookies; }

    get session() { return this.#init.session; }

    get user() { return this.#init.user; }

    get workport() { return this.#init.workport; }

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
    #saveResponseOrigin() {
        const stack = new Error().stack;
        const stackLines = stack.split('\n');
        this.#responseOrigin = stackLines[3].trim();
    }

    async respondWith(response) {
        if (this.#response) {
            throw new Error(`Event has already been responded to! (${this.#responseOrigin})`);
        }
        this.#response = response;
        if (!this.#responseOrigin) {
            this.#saveResponseOrigin();
        }
        if (this.#parentEvent instanceof HttpEvent) {
            // Set responseOrigin first to prevent parent from repeating the work
            this.#parentEvent.#responseOrigin = this.#responseOrigin;
            // Ensure the respondWith() method is how we propagate response
            await this.#parentEvent.respondWith(this.#response);
        } else {
            // The callback passed at root
            await this.#parentEvent?.(response);
        }
    }

    async defer(message = null) {
        this.#saveResponseOrigin();
        await this.respondWith(new Response(message, { status: 202/*Accepted*/ }));
    }

    deferred() {
        return this.#response?.status === 202;
    }

    async with(url, init = {}) {
        let request, _;
        if (url instanceof Request) {
            if (init instanceof Request) { [ /*url*/, init ] = await Request.copy(init); }
            request = !_isEmpty(init) ? new Request(url, init) : url;
        } else {
            url = new xURL(url, this.#url.origin);
            init = await Request.copy(this.request, init);
            request = new Request(url, { ...init, referrer: this.request.url });
        }            
        return new HttpEvent(this, { ...this.#init, request  });
    }
}