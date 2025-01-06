import { _isObject } from '@webqit/util/js/index.js';
import { AbstractStorage } from './AbstractStorage.js';

export class HttpUser extends AbstractStorage {
    
    static create(request, session, workport) {
        return new this(request, session, workport);
    }

    #session;
    #workport;

    constructor(request, session, workport) {
        super(request);
        this.#session = session;
        this.#workport = workport;
        // Trigger this
        this.#dict;
        this.saveOriginals();
    }

    get #dict() {
        if (!this.#session.has('user')) {
            this.#session.set('user', {});
        }
        return this.#session.get('user');
    }

    [ Symbol.iterator ]() { return this.entries()[ Symbol.iterator ](); }

    get size() { return Object.keys(this.#dict).length; }

    set(key, value) {
        Reflect.set(this.#dict, key, value);
        return this;
    }

    get(key) {
        return Reflect.get(this.#dict, key);
    }

    has(key) {
        return Reflect.has(this.#dict, key);
    }

    delete(key) {
        return Reflect.deleteProperty(this.#dict, key);
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

    clear() {
        for (const key of this.keys()) {
            Reflect.deleteProperty(this.#dict, key);
        }
    }

    forEach(callback) {
        this.entries().forEach(callback);
    }

    json(arg = null) {
        if (!arguments.length || typeof arg === 'boolean') {
            return {...this.#dict};
        }
        if (!_isObject(arg)) {
            throw new Error(`Argument must be a valid JSON object`);
        }
        Object.assign(this.#dict, arg);
    }

    isSignedIn() {
        return this.has('auth');
    }

    async signIn(...args) {
        return await this.require(
            ['auth'].concat(typeof args[0] === 'string' || Array.isArray(args[0]) ? args.unshift() : []),
            ...args
        );
    }

    async signOut() {
        const handler = this.getHandlers().get('auth')?.[1];
        let response;
        if (typeof handler === 'string') {
            response = new Response(null, { status: 302, headers: {
                Location: url
            }});
        }
        if (typeof handler === 'function') {
            response = await handler(this);
        }
        this.clear();
        return response;
    }

    alert(data, options = {}) {
        return this.#workport.postMessage(
            data,
            { ...options, eventType: 'alert' }
        );
    }

    confirm(data, callback, options = {}) {
        return new Promise((resolve) => {
            this.#workport.postRequest(
                data,
                (event) => resolve(callback(event)),
                { ...options, eventType: 'confirm' }
            );
        });
    }

    prompt(data, callback, options = {}) {
        return new Promise((resolve) => {
            this.#workport.postRequest(
                data,
                (event) => resolve(callback(event)),
                { ...options, eventType: 'prompt' }
            );
        });
    }
}