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
        this.#init.request.signal?.addEventListener('abort', () => this.#abortController.abort(), { once: true });
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

    #lifecyclePromises = new Set;
    #lifeCycleResolve;
    #lifeCycleReject;
    #lifeCycleResolutionPromise = new Promise((resolve, reject) => {
        this.#lifeCycleResolve = resolve;
        this.#lifeCycleReject = reject;
    });

    #extendLifecycle(promise) {
        if (this.#lifecyclePromises.dirty && !this.#lifecyclePromises.size) {
            throw new Error('Event lifecycle already complete.');
        }
        promise = Promise.resolve(promise);
        this.#lifecyclePromises.add(promise);
        this.#lifecyclePromises.dirty = true;
        promise.then((value) => {
            this.#lifecyclePromises.delete(promise);
            if (!this.#lifecyclePromises.size) {
                this.#lifeCycleResolve(value);
            }
        }).catch(() => {
            this.#lifecyclePromises.delete(promise);
            if (!this.#lifecyclePromises.size) {
                this.#lifeCycleReject();
            }
        });
        if (this.#parentEvent) {
            this.#parentEvent.#extendLifecycle(promise);
        }
    }

    lifeCycleComplete(returningThePromise = false) {
        if (returningThePromise) {
            return this.#lifeCycleResolutionPromise;
        }
        return this.#lifecyclePromises.dirty // IMPORTANT
            && !this.#lifecyclePromises.size;
    }

    waitUntil(promise) {
        this.#extendLifecycle(promise);
    }

    #liveResponse = new LiveResponse(null, { done: false });
    get internalLiveResponse() { return this.#liveResponse; }
    
    async respondWith(data, ...args) {
        await this.#liveResponse.replaceWith(data, ...args);
    }

    async * poll(...args) {
        const callback = typeof args[0] === 'function' ? args.shift() : () => null;
        let { interval = 3000, maxClock = -1, whileOpen = 1, cleanupCall = false } = args[0] || {};
        if (whileOpen) {
            await this.client.ready;
        }
        while (true) {
            const termination = maxClock === 0
                || (whileOpen && !this.client.isOpen())
                || (whileOpen === 2 && this.client.navigatedIn())
                || (whileOpen && whileOpen !== 2 && this.client.navigatedAway());
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

    abort() {
        this.#abortController.abort();
    }
}