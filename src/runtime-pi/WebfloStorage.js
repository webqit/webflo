import { _isObject } from '@webqit/util/js/index.js';
import { _even } from '@webqit/util/obj/index.js';

export class WebfloStorage {
    
    #request;
    #session;
    #registry;
    #key;
    #store;
    #modified = false;

    constructor(registry, key, request, session = null) {
        this.#registry = registry;
        this.#key = key;
        this.#request = request;
        this.#session = session === true ? this : session;
    }
    
    async store() {
        if (!this.#key) {
            return this.#registry;
        }
        if (!this.#store && !(this.#store = await this.#registry.get(this.#key))) {
            this.#store = {};
        }
        return this.#store;
    }

    async refresh() {
        let $store;
        if (!this.#store || !($store = await this.#registry.get(this.#key))) return;
        const { ['#user']: user, ...rest } = $store;
        Object.assign(this.#store, rest);
        if (this.#store['#user']) {
            Object.assign(this.#store['#user'], user);
        }
    }

    async commit() {
        if (this.#store && this.#key && this.#modified) {
            await this.#registry.set(this.#key, this.#store);
        }
        this.#modified = false;
    }

    get size() { return this.store().then((store) => Object.keys(store).length); }

    [ Symbol.iterator ]() { return this.entries().then((entries) => entries[ Symbol.iterator ]()); }

    async json(arg = null) {
        if (!arguments.length || typeof arg === 'boolean') {
            return { ...(await this.store()) };
        }
        if (!_isObject(arg)) {
            throw new Error(`Argument must be a valid JSON object`);
        }
        return await Promise.all(Object.entries(arg).map(([key, value]) => {
            return this.set(key, value);
        }));
    }

    async get(key) { return Reflect.get(await this.store(), key); }

    async has(key) { return Reflect.has(await this.store(), key); }

    async keys() { return Object.keys(await this.store()); }

    async values() { return Object.values(await this.store()); }

    async entries() { return Object.entries(await this.store()); }

    async forEach(callback) { (await this.entries()).forEach(callback); }

    async set(key, value) {
        Reflect.set(await this.store(), key, value);
        this.#modified = true;
        await this.emit(key, value);
        return this;
    }

    async delete(key) {
        Reflect.deleteProperty(await this.store(), key);
        this.#modified = true;
        await this.emit(key);
        return this;
    }

    async clear() {
        for (const key of await this.keys()) {
            Reflect.deleteProperty(await this.store(), key);
        }
        this.#modified = true;
        await this.emit();
        return this;
    }

    #listeners = new Set;
    observe(attr, handler) {
        const args = { attr, handler };
        this.#listeners.add(args);
        return () => {
            this.#listeners.delete(args);
        }
    }

    async emit(attr, value) {
        const returnValues = [];
        for (const { attr: $attr, handler } of this.#listeners) {
            if (arguments.length && $attr !== attr) continue;
            if (arguments.length > 1) {
                returnValues.push(handler(value));
            } else {
                returnValues.push(handler());
            }
        }
        return Promise.all(returnValues);
    }

    #handlers = new Map;
    defineHandler(attr, ...handlers) {
        const $handlers = [];
        for (let handler of handlers) {
            if (typeof handler === 'function') {
                handler = { callback: handler };
            } else if (typeof handler === 'string') {
                handler = { url: handler };
            } else if (typeof handler?.callback !== 'function' && typeof handler?.url !== 'string') {
                throw new Error(`Handler must be either an URL or a function or an object specifying either an URL (handler.url) or a function (handler.callback)`);
            }
            $handlers.push(handler);
        }
        this.#handlers.set(attr, $handlers);
    }

    getHandlers() { return this.#handlers; }

    async require(attrs, callback = null, noNulls = false) {
        const entries = [];
        main: for await (const attr of [].concat(attrs)) {
            if (!(await this.has(attr)) || (noNulls && [undefined, null].includes(await this.get(attr)))) {
                const handlers = this.#handlers.get(attr);
                if (!handlers) {
                    throw new Error(`No handler defined for the user attribute: ${attr}`);
                }
                for (let i = 0; i < handlers.length; i ++) {
                    const handler = handlers[i];
                    if (handler.callback) {
                        const returnValue = await handler.callback(this, attr);
                        if (returnValue instanceof Response) {
                            return returnValue;
                        }
                        if ((typeof returnValue === 'undefined' || (noNulls && returnValue === null)) && i < handlers.length - 1) {
                            continue;
                        }
                        entries.push(returnValue);
                        continue main;
                    }
                    const urlRewrite = new URL(handler.url, this.#request.url);
                    if (!urlRewrite.searchParams.has('success-redirect')) {
                        urlRewrite.searchParams.set('success-redirect', this.#request.url.replace(urlRewrite.origin, ''));
                    }
                    if (handler.message) {
                        if (!this.#session) {
                            throw new Error('Storage type does not support redirect messages');
                        }
                        const messageID = (0 | Math.random() * 9e6).toString(36);
                        urlRewrite.searchParams.set('redirect-message', messageID);
                        await this.#session.set(`redirect-message:${messageID}`, { status: { type: handler.type || 'info', message: handler.message }});
                    }
                    return new Response(null, { status: 302, headers: {
                        Location: urlRewrite
                    }});
                }
            }
            entries.push(await this.get(attr));
        }
        if (callback) return await callback(...entries);
        return entries;
    }
}