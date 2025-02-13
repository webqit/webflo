import { _isObject } from '@webqit/util/js/index.js';
import { _even } from '@webqit/util/obj/index.js';

export class WebfloStorage extends Map {
    
    #request;
    #session;

    constructor(request, session, iterable = []) {
        super();
        this.#request = request;
        this.#session = session === true ? this : session;
        for (const [k, v] of iterable) {
            this.set(k, v);
        }
    }
    
    #originals;
    saveOriginals() { this.#originals = new Map(this); }

    getDeleted() {
        if (!this.#originals) return [];
        return [...this.#originals.keys()].filter((k) => {
            return !this.has(k);
        });
    }

    getAdded() {
        if (!this.#originals) return [...this.keys()];
        return [...new Set([...this.keys(), ...this.#originals.keys()])].filter((k) => {
            return !this.#originals.has(k) || (this.has(k) && ((a, b) => _isObject(a) && _isObject(b) ? !_even(a, b) : a !== b)(this.get(k, true), this.#originals.get(k)));
        });
    }

    async commit() {
        this.saveOriginals();
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

    async set(attr, value) {
        const returnValue = super.set(attr, value);
        await this.emit(attr, value);
        return returnValue;
    }

    async delete(attr) {
        const returnValue = super.delete(attr);
        await this.emit(attr);
        return returnValue;
    }

    async clear() {
        const returnValue = super.clear();
        await this.emit();
        return returnValue;
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
            if (!this.has(attr) || (noNulls && [undefined, null].includes(this.get(attr)))) {
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
            entries.push(this.get(attr));
        }
        if (callback) return await callback(...entries);
        return entries;
    }
}