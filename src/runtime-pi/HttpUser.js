export class HttpUser {
    
    static create(request, session, workport) {
        return new this(request, session, workport);
    }

    #request;
    #session;
    #workport;

    constructor(request, session, workport) {
        this.#request = request;
        this.#session = session;
        this.#workport = workport;
        if (!this.#session.has('user')) {
            this.#session.set('user', {});
        }
    }

    get size() { return Object.keys(this.#session.user).length; }

    set(key, value) {
        Reflect.set(this.#session.user, key, value);
        return this;
    }

    get(key) {
        return Reflect.get(this.#session.user, key);
    }

    has(key) {
        return Reflect.has(this.#session.user, key);
    }

    delete(key) {
        return Reflect.deleteProperty(this.#session.user, key);
    }

    #handlers = new Map;

    defineHandler(attr, handler, invalidationHandler = null) {
        const handlers = [handler].concat(invalidationHandler || []);
        if (!handler || handlers.some((h) => !['string', 'function'].includes(typeof h))) {
            throw new Error(`Handler must be either an URL or a function`);
        }
        this.#handlers.set(attr, handlers);
    }

    signedIn() {
        return this.has('auth');
    }

    async signIn(callback = null) {
        return await this.require('auth', ...arguments);
    }

    async signOut() {
        const handler = this.#handlers.get(attr)?.[1];
        if (typeof handler === 'string') {
            return Response.redirect(url);
        }
        if (typeof handler === 'function') {
            return await handler(this);
        }
        this.clear();
    }

    async require(attrs, callback = null) {
        const entries = [];
        for await (const attr of attrs) {
            if (!this.has(attr)) {
                const handler = this.#handlers.get(attr)?.[0];
                if (!handler) {
                    throw new Error(`No handler defined for the user attribute: ${attr}`);
                }
                if (typeof handler === 'function') {
                    entries.push(await handler(this, attr));
                    continue;
                }
                const urlRewrite = new URL(this.#request.url);
                if (!urlRewrite.searchParams.has('success-redirect')) {
                    urlRewrite.searchParams.set('success-redirect', this.#request.url.replace(urlRewrite.origin, ''));
                }
                return Response.redirect(urlRewrite);
            }
            entries.push(this.get(attr));
        }
        if (callback) return await callback(...entries);
        return entries;
    }

    alert(data, options = {}) {
        return this.#workport.postMessage(
            data,
            { ...options, eventType: 'alert' }
        );
    }

    confirm(data, callback, options = {}) {
        return this.#workport.postRequest(
            data,
            callback,
            { ...options, eventType: 'confim' }
        );
    }

    prompt(data, callback, options = {}) {
        return this.#workport.postRequest(
            data,
            callback,
            { ...options, eventType: 'prompt' }
        );
    }

    toJSON() {
        return Object.fromEntries(this);
    }
}