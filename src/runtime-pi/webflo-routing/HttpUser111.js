import { HttpKeyvalInterface } from './HttpKeyvalInterface.js';

export class HttpUser111 extends HttpKeyvalInterface {

    get _client() { return this._parentEvent.client; }

    async isSignedIn(callback = null, options = {}) {
        const isSignedIn = await this.get('id');
        if (callback) {
            await callback(isSignedIn);
            return options.once
                ? undefined
                : this.subscribe('id', callback, options);
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
            this._client.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, type: 'confirm' }
            );
        });
    }

    async prompt(data, callback, options = {}) {
        return await new Promise((resolve) => {
            this._client.postRequest(
                data,
                (event) => resolve(callback ? callback(event) : event),
                { ...options, type: 'prompt' }
            );
        });
    }
}