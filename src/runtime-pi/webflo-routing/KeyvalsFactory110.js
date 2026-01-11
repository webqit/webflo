import { KeyvalsFactoryInterface } from './KeyvalsFactoryInterface.js';
import { IndexedDBKV } from '@webqit/keyval/indexeddb';
import { CookieStoreKV } from '@webqit/keyval/cookiestore';
import { InMemoryKV } from '@webqit/keyval/inmemory';

export class KeyvalsFactory110 extends KeyvalsFactoryInterface {

    #dbName;
    #channel;
    #cookiePath;

    constructor({ dbName = 'webflo_keyval', cookiePath = '/', channel = '__webflo_app__' } = {}) {
        super();
        this.#dbName = dbName;
        this.#cookiePath = cookiePath;
        this.#channel = channel;

        // Set up Redis watch
        if (this.#channel) {
            const watchClient = new BroadcastChannel(this.#channel);
            watchClient.onmessage = async (message) => {
                try {
                    const event = message.data;
                    if (!Array.isArray(event?.origins)
                        || event.origins[1] === this.instanceID) return;
                    await this.kvHandle._fire(event);
                } catch (e) {
                    console.error('Failed to parse message JSON:', message);
                }
            };
        }
    }

    create({ type = 'indexeddb', ...options }) {
        const { path, ttl = 0 } = options;

        if (!Array.isArray(path) || path.length !== 2) throw new Error('Path must be an array of length 2');
        if (options.origins && (!Array.isArray(options.origins) || options.origins.length !== 1)) throw new Error('Origins must be an array of length 1');
        if (ttl && typeof ttl !== 'number') throw new Error('TTL must be a number');

        const origins = (options.origins || this.defaultOrigins).concat(this.instanceID);

        if (type === 'indexeddb') return IndexedDBKV.create({ dbName: this.#dbName, path, ttl, channel: this.#channel, registry: this.registry, origins });
        if (type === 'cookiestore') return CookieStoreKV.create({ path, ttl, cookiePath: this.#cookiePath, registry: this.registry, origins });
        if (type === 'inmemory') return InMemoryKV.create({ path, ttl, registry: this.registry, origins });
        throw new Error(`Invalid type: ${type}`);
    }
}
