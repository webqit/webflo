import { AbstractStorage } from './AbstractStorage.js';

export class HttpUser extends AbstractStorage {
    
    static create(request, session, workport) {
        if (session.has('user')) {
            return session.get('user');
        }
        const instance = new this(request, session, workport);
        session.set('user', instance);
        return instance;
    }

    #request;
    #session;
    #workport;

    constructor(request, session, workport) {
        super();
        this.#request = request;
        this.#session = session;
        this.#workport = workport;
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

    toJSON() {
        return Object.fromEntries(this);
    }
}