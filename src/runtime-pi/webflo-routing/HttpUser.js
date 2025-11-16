import { HttpState } from './HttpState.js';

export class HttpUser extends HttpState {

    static create({ store, request, realtime, session }) {
        return new this({ store, request, realtime, session });
    }

    #realtime;

    constructor({ store, request, realtime, session }) {
        super({
            store,
            request,
            session
        });
        this.#realtime = realtime;
    }

    async isSignedIn() {
        return await this.has('id');
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
            this.#realtime.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, wqEventOptions: { type: 'confirm' } }
            );
        });
    }

    async prompt(data, callback, options = {}) {
        return await new Promise((resolve) => {
            this.#realtime.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, wqEventOptions: { type: 'prompt' } }
            );
        });
    }
}