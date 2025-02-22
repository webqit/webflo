import { WebfloStorage } from './WebfloStorage.js';

export class HttpUser extends WebfloStorage {
    
    static create(request, session, client) {
        return new this(request, session, client);
    }

    #session;
    #client;

    constructor(request, session, client) {
        super(session, '#user', request, session);
        this.#session = session;
        this.#client = client;
    }

    async isSignedIn() {
        await this.#session.refresh();
        return await this.has('id');
    }

    async signIn(...args) {
        await this.#session.refresh();
        return await this.require(
            ['id'].concat(typeof args[0] === 'string' || Array.isArray(args[0]) ? args.unshift() : []),
            ...args
        );
    }

    async signOut() {
        await this.clear();
        await this.#session.commit();
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