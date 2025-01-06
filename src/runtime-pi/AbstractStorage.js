import { _isObject } from '@webqit/util/js/index.js';
import { _even } from '@webqit/util/obj/index.js';

export class AbstractStorage extends Map {
    
    #request;

    constructor(request, iterable = []) {
        super(iterable);
        this.#request = request;
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

    #handlers = new Map;
    defineHandler(attr, handler, invalidationHandler = null) {
        const handlers = [handler].concat(invalidationHandler || []);
        if (!handler || handlers.some((h) => !['string', 'function'].includes(typeof h))) {
            throw new Error(`Handler must be either an URL or a function`);
        }
        this.#handlers.set(attr, handlers);
    }

    getHandlers() { return this.#handlers; }

    async require(attrs, callback = null) {
        const entries = [];
        for await (const attr of attrs) {
            if (!this.has(attr)) {
                const handler = this.#handlers.get(attr)?.[0];
                if (!handler) {
                    throw new Error(`No handler defined for the user attribute: ${attr}`);
                }
                if (typeof handler === 'function') {
                    const returnValue = await handler(this, attr);
                    if (returnValue instanceof Response) {
                        return returnValue;
                    }
                    entries.push(returnValue);
                    continue;
                }
                const urlRewrite = new URL(this.#request.url);
                if (!urlRewrite.searchParams.has('success-redirect')) {
                    urlRewrite.searchParams.set('success-redirect', this.#request.url.replace(urlRewrite.origin, ''));
                }
                return new Response(null, { status: 302, headers: {
                    Location: urlRewrite
                }});
            }
            entries.push(this.get(attr));
        }
        if (callback) return await callback(...entries);
        return entries;
    }
}