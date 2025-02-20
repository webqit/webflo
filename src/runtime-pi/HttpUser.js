import { WebfloStorage } from './WebfloStorage.js';

export class HttpUser extends WebfloStorage {
    
    static create(request, session, client) {
        return new this(request, session, client);
    }

    #client;

    constructor(request, session, client) {
        super(session, '#user', request, session);
        this.#client = client;
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