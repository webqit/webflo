import { KV } from '@webqit/keyval/inmemory';

export class KeyvalsFactoryInterface {

    #instanceID = (0 | Math.random() * 9e6).toString(36);
    #registry = new Map;
    #defaultOrigins = ['*'/* requestID */];
    #kvHandle;

    get instanceID() { return this.#instanceID; }
    get registry() { return this.#registry; }
    get defaultOrigins() { return this.#defaultOrigins; }
    get kvHandle() { return this.#kvHandle; }

    constructor() {
        this.#kvHandle = KV.create({ path: [], registry: this.#registry, origins: this.#defaultOrigins.concat(this.#instanceID) });
    }

    subscribe(kvKey, callback, { scope = 1, ...options } = {}) {
        if (!kvKey) throw new Error('kvKey must be specified');
        return this.#kvHandle.subscribe(kvKey, callback, { scope, ...options });
    }

    #handlers = new Map;

    defineHandler(kvKey, key, ...handlers) {
        const $handlers = [];
        for (let handler of handlers) {
            if (typeof handler === 'function') {
                handler = { callback: handler };
            } else if (typeof handler === 'string') {
                handler = { url: handler };
            } else if (!(typeof handler === 'object' && handler && (handler = { ...handler }))
                || typeof handler.callback !== 'function' && typeof handler.url !== 'string') {
                throw new Error(`Handler must be either an URL or a function or an object specifying either an URL (handler.url) or a function (handler.callback)`);
            }
            if (typeof handler.with === 'object' && handler.with) {
                handler.with = { ...handler.with };
            } else if (handler.with) {
                throw new Error(`The "with" parameter must be a valid JSON object`);
            }
            $handlers.push(handler);
        }
        if (!this.#handlers.has(kvKey)) {
            this.#handlers.set(kvKey, new Map);
        }
        this.#handlers.get(kvKey).set(key, $handlers);
    }

    getHandlers(kvKey, autoCreate = false) {
        if (!this.#handlers.has(kvKey) && autoCreate) {
            this.#handlers.set(kvKey, new Map);
        }
        return this.#handlers.get(kvKey);
    }
}
