import { HttpState } from './HttpState.js';

export class HttpUser extends HttpState {

    static create({ store, request, thread, client }) {
        return new this({ store, request, thread, client });
    }

    #client;

    constructor({ store, request, thread, client }) {
        super({
            store,
            request,
            thread
        });
        this.#client = client;
    }

    async isSignedIn(callback = null, options = {}) {
        const isSignedIn = await this.get('id');
        if (callback) {
            await callback(isSignedIn);
            return options.once
                ? undefined
                : this.observe('id', callback, options);
        }
        return !!isSignedIn;
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
                { ...options, wqEventOptions: { type: 'confirm' } }
            );
        });
    }

    async prompt(data, callback, options = {}) {
        return await new Promise((resolve) => {
            this.#client.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, wqEventOptions: { type: 'prompt' } }
            );
        });
    }
}