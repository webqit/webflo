import { KV } from '@webqit/keyval/inmemory';

export class HttpThread111 {

    // ------ factory

    static create({ context = {}, store, threadID, realm = 0 }) {
        let hydrationMode = true;
        if (!threadID || !/^[01]{3}-/.test(threadID)) {
            threadID = `${realm === 3 ? '001' : '110'}-${(0 | Math.random() * 9e6).toString(36)}`;
            hydrationMode = false;
        }
        return new this({ context, store, threadID, realm, lifecycle: { dirty: hydrationMode, extended: false } });
    }

    // ------

    #context = {};
    #store;
    #threadID;
    #realm;
    #lifecycle;

    get threadID() { return this.#threadID; }
    get dirty() { return !!this.#lifecycle.dirty; }
    get extended() { return !!this.#lifecycle.extended; }

    get _context() { return this.#context; }
    get _parentEvent() { return this.#context?.parentEvent; }

    constructor({ context = {}, store, threadID, realm = 0, lifecycle = { dirty: false, extended: false } }) {
        if (!(store instanceof KV)) {
            throw new Error('HttpKeyval expects a valid store instance!');
        }
        if (context) Object.assign(this.#context, context);
        this.#store = store;
        this.#threadID = threadID;
        this.#realm = realm;
        this.#lifecycle = lifecycle;
    }

    // ------ lifecycle

    extend(set = true) { this.#lifecycle.extended = !!set; }

    clone() {
        return new this.constructor({
            context: this.#context,
            store: this.#store,
            threadID: this.#threadID,
            realm: this.#realm,
            lifecycle: this.#lifecycle,
        });
    }

    spawn(threadID = null) {
        return this.constructor.create({
            context: this.#context,
            store: this.#store,
            threadID: threadID,
            realm: this.#realm
        });
    }

    async _cleanup() {
        if (this.#lifecycle.extended) return;
        await this.clear();
    }

    // ------ standard methods

    async keys() {
        if (!this.#lifecycle.dirty) return [];
        const thread = await this.#store.get(this.#threadID) || {};
        return Object.keys(thread);
    }

    async has(key) {
        if (!this.#lifecycle.dirty) return false;
        return (await this.keys()).includes(key);
    }

    async append(key, value) {
        this.#lifecycle.dirty = true;

        const thread = await this.#store.get(this.#threadID) || {};
        thread[key] = { content: value, context: thread[key] };

        await this.#store.set(this.#threadID, thread);
    }

    async appendEach(hash) {
        this.#lifecycle.dirty = true;

        const thread = await this.#store.get(this.#threadID) || {};
        for (const [key, value] of Object.entries(hash)) {
            thread[key] = { content: value, context: thread[key] };
        }

        await this.#store.set(this.#threadID, thread);
    }

    async get(key, withContext = false) {
        if (!this.#lifecycle.dirty) return null;
        const thread = await this.#store.get(this.#threadID) || {};
        return (withContext ? thread[key] : thread[key]?.content) || null;
    }

    async consume(key, withContext = false) {
        if (!this.#lifecycle.dirty) return null;
        const thread = await this.#store.get(this.#threadID) || {};

        const value = thread[key];
        delete thread[key];

        if (!Object.keys(thread).length) {
            await this.#store.delete(this.#threadID);
        } else {
            await this.#store.set(this.#threadID, thread);
        }

        return (withContext ? value : value?.content) || null;
    }

    async clear() {
        if (!this.#lifecycle.dirty) return;
        await this.#store.delete(this.#threadID);
    }
}