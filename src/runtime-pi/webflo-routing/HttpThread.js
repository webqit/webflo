export class HttpThread {

    static create({ store, threadID, realm }) {
        if (!threadID || !(new RegExp(`^wq\\.${realm}\\.`)).test(threadID)) {
            threadID = `wq.${realm}.${crypto.randomUUID()}`;
        }
        return new this({ store, threadID, realm });
    }

    #store;
    #threadID;
    #realm;
    #extended = false;

    get threadID() { return this.#threadID; }

    constructor({ store, threadID, realm }) {
        this.#store = store || new Map;
        this.#threadID = threadID;
        this.#realm = realm;
    }

    spawn(_threadID = null) {
        return this.constructor.create({
            store: this.#store,
            threadID: _threadID,
            realm: this.#realm
        });
    }

    async keys() {
        const thread = await this.#store.get(this.#threadID) || {};
        return Object.keys(thread);
    }

    async has(key, filter = null) {
        if (filter === true || !filter) return (await this.keys()).includes(key);
        const thread = await this.#store.get(this.#threadID) || {};
        const values = [].concat(thread[key] ?? []);
        return values.findIndex(filter) !== -1;
    }

    async append(key, value) {
        const thread = await this.#store.get(this.#threadID) || {};
        thread[key] = [].concat(thread[key] ?? []);
        thread[key].push(value);
        await this.#store.set(this.#threadID, thread);
        return this;
    }

    async get(key, filter = null) {
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
        await this.#store.delete(this.#threadID);
        return this;
    }

    get extended() { return this.#extended; }

    extend(set = true) { this.#extended = !!set; }
}