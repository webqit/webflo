import { _isObject } from '@webqit/util/js/index.js';
import { _even } from '@webqit/util/obj/index.js';
import { HttpEvent } from './HttpEvent.js';

export class HttpState {

    #store;
    #request;
    #thread;
    #modified = false;

    constructor({ store, request, thread }) {
        this.#store = store || new Map;
        this.#request = request;
        this.#thread = thread === true ? this : thread;
    }

    async has(key) { return await this.#store.has(key); }

    async get(key) { return await this.#store.get(key); }

    async set(key, value) {
        await this.#store.set(key, value);
        this.#modified = true;
        await this.emit(key, value);
        return this;
    }

    async delete(key) {
        await this.#store.delete(key);
        this.#modified = true;
        await this.emit(key);
        return this;
    }

    async clear() {
        await this.#store.clear();
        this.#modified = true;
        await this.emit();
        return this;
    }

    async keys() { return [...await this.#store.keys()]; }

    async values() { return [...await this.#store.values()]; }

    async entries() { return [...await this.#store.entries()]; }

    async json(arg = null) {
        if (!arguments.length || typeof arg === 'boolean') {
            return Object.fromEntries(await this.#store.entries());
        }
        if (!_isObject(arg)) {
            throw new Error(`Argument must be a valid JSON object`);
        }
        return await Promise.all(Object.entries(arg).map(([key, value]) => {
            return this.set(key, value);
        }));
    }

    async forEach(callback) { (await this.entries()).forEach(([key, value], i) => callback(value, key, i)); }

    [Symbol.iterator]() { return this.entries().then((entries) => entries[Symbol.iterator]()); }

    get size() { return this.#store.sizs; }

    async commit() {
        this.#modified = false;
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
            } else if (!(_isObject(handler) && (handler = { ...handler })) 
                || typeof handler.callback !== 'function' && typeof handler.url !== 'string') {
                throw new Error(`Handler must be either an URL or a function or an object specifying either an URL (handler.url) or a function (handler.callback)`);
            }
            if (_isObject(handler.with)) {
                handler.with = { ...handler.with };
            } else if (handler.with) {
                throw new Error(`The "with" parameter must be a valid JSON object`);
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
                for (let i = 0; i < handlers.length; i++) {
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
                    if (callback instanceof HttpEvent) {
                        await callback.redirectWith(handler.url, handler.with || {});
                        return new Promise(() => { });
                    }
                    const urlRewrite = new URL(handler.url, this.#request.url);
                    const newThread = this.#thread.spawn(urlRewrite.searchParams.get('_thread')/* show */);
                    urlRewrite.searchParams.set('_thread', newThread.threadID);
                    await newThread.append('back', this.#request.url.replace(urlRewrite.origin, ''));
                    if (handler.with) {
                        for (const [key, value] of Object.entries(handler.with)) {
                            await newThread.append(key, value);
                        }
                    }
                    return new Response(null, {
                        status: 302, headers: {
                            Location: urlRewrite
                        }
                    });
                }
            }
            entries.push(await this.get(attr));
        }
        if (callback && !(callback instanceof HttpEvent)) {
            return await callback(...entries);
        }
        return entries;
    }
}