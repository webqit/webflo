import { _isObject } from '@webqit/util/js/index.js';
import { _difference } from '@webqit/util/arr/index.js';
import { LiveResponse } from '../webflo-fetch/LiveResponse.js';
import { xURL } from '../webflo-url/xURL.js';
import { _wq } from '../../util.js';

export class HttpEvent {

    static create(parentEvent, init = {}) {
        return new this(parentEvent, init);
    }

    #parentEvent;
    #url;
    #init;
    #abortController = new AbortController;

    constructor(parentEvent, { request, cookies, session, user, client, detail, signal, state, ...rest }) {
        this.#parentEvent = parentEvent;
        this.#init = { request, cookies, session, user, client, detail, signal, state, ...rest };
        this.#url = new xURL(this.#init.request.url);
        this.#parentEvent?.signal.addEventListener('abort', () => this.#abortController.abort(), { once: true });
        this.#init.request.signal?.addEventListener('abort', () => this.#abortController.abort(), { once: true });
        this.#lifeCycleResolutionPromise.finally(() => {
            this.#abortController.abort();
        });
    }

    get url() { return this.#url; }

    get request() { return this.#init.request; }

    get client() { return this.#init.client; }

    get cookies() { return this.#init.cookies; }

    get session() { return this.#init.session; }

    get user() { return this.#init.user; }

    get detail() { return this.#init.detail; }

    get signal() { return this.#abortController.signal; }

    get state() { return { ...(this.#init.state || {}) }; }

    #lifecyclePromises = new Set;
    get lifecyclePromises() { return this.#lifecyclePromises; }

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
        return promise.then((value) => {
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
    }

    lifeCycleComplete(returningThePromise = false) {
        if (returningThePromise) {
            return this.#lifeCycleResolutionPromise;
        }
        return this.#lifecyclePromises.dirty // IMPORTANT
            && !this.#lifecyclePromises.size;
    }

    async waitUntil(promise) {
        return await this.#extendLifecycle(promise);
    }

    waitUntilNavigate() {
        this.waitUntil(new Promise(() => { }));
    }

    #internalLiveResponse = new LiveResponse(null, { done: false });
    get internalLiveResponse() { return this.#internalLiveResponse; }

    async respondWith(data, ...args) {
        await this.#internalLiveResponse.replaceWith(data, ...args);
    }

    clone(init = {}) {
        return this.constructor.create(this.#parentEvent, { ...this.#init, ...init });
    }

    extend(init = {}) {
        const instance = this.constructor.create(this/*Main difference from clone*/, { ...this.#init, ...(init || {}) });
        if (init !== false) this.#extendLifecycle(instance.lifeCycleComplete(true));
        return instance;
    }

    abort() {
        this.#abortController.abort();
    }
}