import { LiveResponse } from '@webqit/fetch-plus';
import { KV } from '@webqit/keyval/inmemory';

export class HttpKeyvalInterface {

    static create(init = {}) {
        return new this(init);
    }

    #context = {};
    #store;
    #realm;
    #rest;

    #cleanups = new Set

    get _context() { return this.#context; }
    get _parentEvent() { return this.#context?.parentEvent; }

    constructor({ context = {}, store, realm = 0, ...rest }) {
        if (!(store instanceof KV)) {
            throw new Error('HttpKeyval expects a valid store instance!');
        }
        if (context) Object.assign(this.#context, context);
        this.#store = store;
        this.#realm = realm;
        this.#rest = rest;
    }

    // ------ lifecycle

    clone() {
        return new this.constructor({
            context: this.#context,
            store: this.#store,
            realm: this.#realm,
            ...this.#rest,
        });
    }

    async _cleanup() { this.#cleanups.forEach((fn) => fn()); }

    // ------ standard methods

    async count() { return await this.#store.count(); }
    async keys() { return [...await this.#store.keys()]; }
    async values() { return [...await this.#store.values()]; }
    async entries() { return [...await this.#store.entries()]; }
    async has(key) { return await this.#store.has(key); }
    async get(key) { return await this.#store.get(key); }
    async set(key, value) { await this.#store.set(key, value); }
    async delete(key) { await this.#store.delete(key); }
    async clear() { await this.#store.clear(); }
    async json(...args) { return await this.#store.json(...args); }

    // ------ extras

    subscribe(...args) {
        const cleanup = this.#store.subscribe(...args);
        this.#cleanups.add(cleanup);
        return cleanup;
    }

    async require(attrs, callback = null, options = {}) {
        const handlersRegistry = this.#context?.handlersRegistry;
        if (!handlersRegistry) throw new Error(`No handlers registry in context`);

        if (typeof callback === 'object' && callback && arguments.length === 2) {
            options = callback;
            callback = null;
        }

        if (callback && typeof callback !== 'function') {
            throw new Error('Callback must be a valid function when provided');
        }

        const entries = [];
        main: for await (const attr of [].concat(attrs)) {
            const value = await this.get(attr);
            if (value === undefined && !await this.has(attr)
                || options.noNulls && [undefined, null].includes(value)) {

                const handlers = handlersRegistry.get(attr);
                if (!handlers) {
                    throw new Error(`No handler defined for the user attribute: ${attr}`);
                }

                for (let i = 0; i < handlers.length; i++) {
                    const handler = handlers[i];

                    if (handler.callback) {
                        const returnValue = await handler.callback(this._parentEvent, attr);
                        if (returnValue instanceof Response || returnValue instanceof LiveResponse) {
                            await this._parentEvent.respondWith(returnValue);
                            return new Promise(() => { });
                        }

                        if ((typeof returnValue === 'undefined' || (options.noNulls && returnValue === null)) && i < handlers.length - 1) {
                            continue;
                        }

                        entries.push(returnValue);
                        continue main;
                    }

                    await this._parentEvent.redirectWith(handler.url, handler.with || {});
                    return new Promise(() => { });
                }
            }

            entries.push(value);
        }

        if (callback) {
            return await callback(...entries);
        }

        return entries;
    }
}