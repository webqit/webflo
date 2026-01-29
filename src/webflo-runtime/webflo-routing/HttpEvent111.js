import { _isObject } from '@webqit/util/js/index.js';
import { LiveResponse } from '@webqit/fetch-plus';
import { URLPlus } from '@webqit/url-plus';

export class HttpEvent111 {

    static create(init = {}) {
        return new this(init);
    }

    #context = {};
    #init;
    #url;

    #readyStates;
    #abortController = new AbortController;

    #internalLiveResponse = new LiveResponse(null, { done: false });
    get internalLiveResponse() { return this.#internalLiveResponse; }

    get _context() { return this.#context; }
    get _parentEvent() { return this.#context?.parentEvent; }

    constructor({ context = {}, request, thread, cookies, session, user, client, detail, signal, state, ...rest }) {
        if (context) Object.assign(this.#context, context);

        this.#init = { context, request, thread, cookies, session, user, client, detail, signal, state, ...rest };
        [thread, cookies, session, user].forEach((node) => {
            if (!node) return;
            node._context.parentEvent = this;
        });

        this.#url = new URLPlus(this.#init.request.url, undefined, { immutable: true });

        this._parentEvent?.signal.addEventListener('abort', () => this.#abortController.abort(), { once: true });
        this.#init.request.signal?.addEventListener('abort', () => this.#abortController.abort(), { once: true });

        const $ref = (o) => {
            o.promise = new Promise((res, rej) => (o.resolve = res, o.reject = rej));
            return o;
        };
        this.#readyStates = {
            live: $ref({}),
            done: $ref({}),
        };

        this.#readyStates.done.promise.finally(() => {
            this.#abortController.abort();
        });
    }

    // ------ lifecycle

    #lifecyclePromises = new Set;
    #extendLifecycle(promise) {
        if (this.#readyStates.done.state) {
            throw new Error('Event lifecycle already complete.');
        }

        if (this._parentEvent) {
            this._parentEvent.waitUntil(promise);
        }

        promise = Promise.resolve(promise);
        this.#lifecyclePromises.add(promise);

        if (!this.#readyStates.live.state) {
            this.#readyStates.live.state = true;
            this.#readyStates.live.resolve();
        }

        return promise.then((value) => {
            this.#lifecyclePromises.delete(promise);
            if (!this.#lifecyclePromises.size) {
                this.#readyStates.done.state = true;
                this.#readyStates.done.resolve(value);
            }
        }).catch((e) => {
            this.#lifecyclePromises.delete(promise);
            if (!this.#lifecyclePromises.size) {
                this.#readyStates.done.state = true;
                this.#readyStates.done.reject(e);
            }
        });
    }

    get readyState() {
        return this.#readyStates.done.state ? 'done'
            : (this.#readyStates.live.state ? 'live' : 'waiting');
    }

    readyStateChange(query) {
        if (!['live', 'done'].includes(query)) {
            throw new Error(`Invalid readyState query "${query}"`);
        }
        return this.#readyStates[query].promise;
    }

    spawn(init = {}) {
        const clone = this.clone(init);
        clone._context.parentEvent = this;
        return clone;
    }

    abort() { this.#abortController.abort(); }

    clone(init = {}) {
        const $init = { ...this.#init, ...init };
        ['thread', 'cookies', 'session', 'user'].forEach((nodeName) => {
            if (!init[nodeName]) $init[nodeName] = $init[nodeName].clone();
        });
        return this.constructor.create($init);
    }

    // ------

    get signal() { return this.#abortController.signal; }
    get url() { return this.#url; }
    get request() { return this.#init.request; }
    get thread() { return this.#init.thread; }
    get cookies() { return this.#init.cookies; }
    get session() { return this.#init.session; }
    get user() { return this.#init.user; }
    get client() { return this.#init.client; }
    get detail() { return this.#init.detail; }
    get state() { return { ...(this.#init.state || {}) }; }

    // ------

    async waitUntil(promise) {
        return await this.#extendLifecycle(promise);
    }

    async waitUntilNavigate() {
        /* DO NOT AWAIT */this.waitUntil(new Promise(() => { }));
    }

    async respondWith(data, ...args) {
        await this.#internalLiveResponse.replaceWith(data, ...args);
    }

    async redirect(url, status = 302) {
        if (typeof url !== 'string' && !(url instanceof URL)) {
            throw new Error('Redirect URL must be a string or URL!');
        }
        let options = {};
        if (_isObject(status)) {
            ({ status = 302, ...options } = status);
        }
        if (typeof status !== 'number') {
            throw new Error('Redirect code must be a number!');
        }
        return await this.respondWith(null, { status, ...options, headers: { Location: url } });
    }

    async redirectWith(url, data, status = 302) {
        if (typeof url !== 'string' && !(url instanceof URL)) {
            throw new Error('Redirect URL must be a string or URL!');
        }
        let options = {};
        if (_isObject(status)) {
            ({ status = 302, ...options } = status);
        }
        if (typeof status !== 'number') {
            throw new Error('Redirect code must be a number!');
        }
        //-----
        const urlRewrite = new URL(url, this.request.url);
        const newThread = this.thread.spawn(urlRewrite.searchParams.get('_thread'));
        urlRewrite.searchParams.set('_thread', newThread.threadID);

        const back = this.request.url.replace(urlRewrite.origin, '');
        await newThread.appendEach({ back, ...data });

        if (this.url.query['_thread']) {
            this.thread.extend();
        }
        //-----
        return await this.respondWith(null, { status, ...options, headers: { Location: urlRewrite.href } });
    }
}
