import { KV } from '@webqit/keyval/inmemory';

export class HttpThread111 {

    // ------ factory

    static create({ context = {}, store, threadID, realm = 0 }) {
        let hydrationMode = true;
        if (!threadID || !(new RegExp(`^wq\\.${realm}\\.`)).test(threadID)) {
            threadID = `wq.${realm}.${(0 | Math.random() * 9e6).toString(36)}`;//`wq.${realm}.${crypto.randomUUID()}`;
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

    async has(key, filter = null) {
        if (!this.#lifecycle.dirty) return false;
        if (filter === true || !filter) return (await this.keys()).includes(key);
        const thread = await this.#store.get(this.#threadID) || {};
        const values = [].concat(thread[key] ?? []);
        return values.findIndex(filter) !== -1;
    }

    async append(key, value) {
        this.#lifecycle.dirty = true;
        const thread = await this.#store.get(this.#threadID) || {};
        thread[key] = [].concat(thread[key] ?? []);
        thread[key].push(value);
        await this.#store.set(this.#threadID, thread);
    }

    async get(key, filter = null) {
        if (!this.#lifecycle.dirty) return filter === true ? [] : undefined;
        const thread = await this.#store.get(this.#threadID) || {};
        const values = [].concat(thread[key] ?? []);

        let value;
        if (filter === true) {
            value = values;
        } else if (filter) {
            value = values.find(filter);
        } else { value = values[values.length - 1]; }

        return value;
    }

    async consume(key, filter = null) {
        if (!this.#lifecycle.dirty) return filter === true ? [] : undefined;
        const thread = await this.#store.get(this.#threadID) || {};
        const values = [].concat(thread[key] ?? []);

        let value;
        if (filter === true) {
            delete thread[key];
            value = values;
        } else if (filter) {
            const i = values.findIndex(filter);
            if (i !== -1) {
                value = values.splice(i, 1)[0];
            }
        } else { value = values.pop(); }

        if (!values.length) {
            delete thread[key];
        }
        if (!Object.keys(thread).length) {
            await this.#store.delete(this.#threadID);
        } else {
            await this.#store.set(this.#threadID, thread);
        }

        return value;
    }

    async clear() {
        if (!this.#lifecycle.dirty) return;
        await this.#store.delete(this.#threadID);
    }
}