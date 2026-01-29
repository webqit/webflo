import { KeyvalsFactoryInterface } from './KeyvalsFactoryInterface.js';
import { RedisKV, createClient } from '@webqit/keyval/redis';
import { InMemoryKV } from '@webqit/keyval/inmemory';
import { FileKV } from '@webqit/keyval/file';

export class KeyvalsFactory001 extends KeyvalsFactoryInterface {

    #redisNamespace;
    #redisChannel;
    #redisUrl;
    #localDir;

    constructor({ localDir = null, redisUrl = null, redisNamespace = '*', redisChannel = null, } = {}) {
        super();
        this.#localDir = localDir;
        this.#redisUrl = redisUrl;
        this.#redisNamespace = redisNamespace;
        this.#redisChannel = redisChannel ?? `__webflo_app__@${this.#redisNamespace}`;

        // Set up Redis watch
        if (this.#redisUrl && this.#redisChannel) {
            const watchClient = createClient({ url: this.#redisUrl });
            watchClient.connect().then(() => {
                watchClient.subscribe(this.#redisChannel, async (message) => {
                    try {
                        const event = JSON.parse(message?.trim());
                        if (!Array.isArray(event?.origins)
                            || event.origins[1] === this.instanceID) return;
                        await this.kvHandle._fire(event);
                    } catch (e) {
                        console.error('Failed to parse message JSON:', message);
                        console.error(e, '\n\n');
                    }
                });
            });
        }
    }

    create({ type, ...options }) {
        const { path, ttl = null } = options;

        if (!Array.isArray(path) || path.length !== 2) throw new Error('Path must be an array of length 2');
        if (options.origins && (!Array.isArray(options.origins) || options.origins.length !== 1)) throw new Error('Origins must be an array of length 1');
        if (ttl !== null && typeof ttl !== 'number') throw new Error('TTL must be a number');

        const origins = (options.origins || this.defaultOrigins).concat(this.instanceID);

        if (type === 'redis' || !type && this.#redisUrl) return RedisKV.create({ path, ttl, redisUrl: this.#redisUrl, channel: this.#redisChannel, namespace: this.#redisNamespace, registry: this.registry, origins });
        if (type === 'file' || !type && this.#localDir) return FileKV.create({ path, ttl, dir: this.#localDir, registry: this.registry, origins });
        if (type === 'inmemory' || !type) return InMemoryKV.create({ path, ttl, registry: this.registry, origins });
        throw new Error(`Invalid type: ${type}`);
    }
}
