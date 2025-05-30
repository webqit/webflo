import { _difference } from '@webqit/util/arr/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { xURL } from '../webflo-url/xURL.js';

export class HttpEvent {

    static create(parentEvent, init = {}) {
        return new this(parentEvent, init);
    }

    #parentEvent;
    #url;
    #init;
    #abortController = new AbortController;

    constructor(parentEvent, { request, cookies, session, user, client, sdk, detail, signal, state, ...rest }) {
        this.#parentEvent = parentEvent;
        this.#init = { request, cookies, session, user, client, sdk, detail, signal, state, ...rest };
        this.#url = new xURL(this.#init.request.url);
        this.#init.signal?.addEventListener('abort', () => this.#abortController.abort(), { once: true });
    }

    get url() { return this.#url; }

    get request() { return this.#init.request; }

    get cookies() { return this.#init.cookies; }

    get session() { return this.#init.session; }

    get user() { return this.#init.user; }

    get client() { return this.#init.client; }

    get sdk() { return this.#init.sdk; }

    get detail() { return this.#init.detail; }

    get signal() { return this.#abortController.signal; }

    get state() { return { ...(this.#init.state || {}) }; }

    #eventLifecyclePromises;
    get eventLifecyclePromises() {
        if (this.#parentEvent) {
            return this.#parentEvent.eventLifecyclePromises;
        }
        if (!this.#eventLifecyclePromises) {
            this.#eventLifecyclePromises = new Set;
        }
        return this.#eventLifecyclePromises;
    }

    abort() {
        this.#abortController.abort();
    }

    waitUntil(promise) {
        promise = Promise.resolve(promise);
        this.eventLifecyclePromises.add(promise);
        this.eventLifecyclePromises.dirty = true;
        promise.then(() => {
            this.eventLifecyclePromises.delete(promise);
        });
    }

    async * poll(...args) {
        const callback = typeof args[0] === 'function' ? args.shift() : () => null;
        let { interval = 3000, maxClock = -1, whileConnected = 1, cleanupCall = false } = args[0] || {};
        if (whileConnected) {
            await this.client.ready;
        }
        while (true) {
            const termination = maxClock === 0
                || (whileConnected && !this.client.isConnected()) 
                || (whileConnected === 2 && this.client.navigatedIn()) 
                || (whileConnected && whileConnected !== 2 && this.client.navigatedAway());
            const returnValue = (!termination || cleanupCall) && await callback(termination) || { done: true };
            if (returnValue !== undefined && (!_isObject(returnValue) || _difference(Object.keys(returnValue || {}), ['value', 'done']).length)) {
                throw new Error('Callback must return an object with only "value" and "done" properties');
            }
            if (typeof returnValue?.value !== 'undefined') {
                yield returnValue.value;
            }
            if (returnValue?.done) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, interval));
            maxClock--;
        }
    }

    clone(init = {}) {
        return this.constructor.create(this.#parentEvent, { ...this.#init, ...init });
    }

    extend(init = {}) {
        return this.constructor.create(this/*Main difference from clone*/, { ...this.#init, ...init });
    }
}