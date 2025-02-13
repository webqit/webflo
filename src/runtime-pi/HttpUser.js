import { _isObject } from '@webqit/util/js/index.js';
import { WebfloStorage } from './WebfloStorage.js';

export class HttpUser extends WebfloStorage {
    
    static create(request, session, client) {
        return new this(request, session, client);
    }

    #session;
    #client;

    constructor(request, session, client) {
        super(request, session);
        this.#session = session;
        this.#client = client;
        // Trigger this
        this.#dict;
    }

    get #dict() {
        return this.#session.get('user') || {};
    }

    [ Symbol.iterator ]() { return this.entries()[ Symbol.iterator ](); }

    get size() { return Object.keys(this.#dict).length; }

    get(key) {
        return Reflect.get(this.#dict, key);
    }

    has(key) {
        return Reflect.has(this.#dict, key);
    }

    keys() {
        return Object.keys(this.#dict);
    }

    values() {
        return Object.values(this.#dict);
    }

    entries() {
        return Object.entries(this.#dict);
    }

    forEach(callback) {
        this.entries().forEach(callback);
    }

    async set(key, value) {
        if (!this.#session.has('user')) {
            await this.#session.set('user', {});
        }
        Reflect.set(this.#dict, key, value);
        await this.emit(key, value);
        return this;
    }

    async delete(key) {
        if (!this.#session.has('user')) {
            await this.#session.set('user', {});
        }
        Reflect.deleteProperty(this.#dict, key);
        await this.emit(key);
        return this;
    }

    async clear() {
        for (const key of this.keys()) {
            Reflect.deleteProperty(this.#dict, key);
        }
        await this.emit();
        return this;
    }

    async json(arg = null) {
        if (!arguments.length || typeof arg === 'boolean') {
            return {...this.#dict};
        }
        if (!_isObject(arg)) {
            throw new Error(`Argument must be a valid JSON object`);
        }
        return await Promise.all(Object.entries(arg).map(([key, value]) => {
            return this.set(key, value);
        }));
    }

    isSignedIn() {
        return this.has('id');
    }

    async signIn(...args) {
        return await this.require(
            ['id'].concat(typeof args[0] === 'string' || Array.isArray(args[0]) ? args.unshift() : []),
            ...args
        );
    }

    async signOut() {
        await this.clear();
    }

    async confirm(data, callback, options = {}) {
        return await new Promise((resolve) => {
            this.#client.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, messageType: 'confirm' }
            );
        });
    }

    async prompt(data, callback, options = {}) {
        return await new Promise((resolve) => {
            this.#client.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, messageType: 'prompt' }
            );
        });
    }
}