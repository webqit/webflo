import { WebfloMessagingAPI } from '../../webflo-messaging/WebfloMessagingAPI.js';
import { Tenant } from './Tenant.js';

export class Channel extends WebfloMessagingAPI {

    #channelID;
    get channelID() { return this.#channelID; }

    #tenants = new Set;
    get tenants() { return this.#tenants; }

    constructor(parentNode, channelID, params = {}) {
        super(parentNode, params);
        this.#channelID = channelID;
    }

    [Symbol.iterator]() { return this.#tenants[Symbol.iterator](); }

    addTenant(tenant, resolveMessage = (m) => m) {
        if (!(tenant instanceof Tenant)) {
            throw new TypeError('Port must be a Tenant Messaging Port');
        }
        if (this.#tenants.has(tenant)) return;
        // Lifecycle management
        this.#tenants.add(tenant);
        this.$emit('add', tenant);
        if (!this.isOpen()) {
            this.dispatchEvent(new Event('open'));
            this.$emit('open');
        }
        // Notify participants
        for (const $tenant of this.#tenants) {
            if ($tenant === tenant) continue;
            $tenant.postMessage(resolveMessage({
                event: 'joins',
            }), { eventOptions: { type: `broadcast:${this.channelID}` } });
        }
        // Router messages
        const broadcastHandler = (e) => {
            let recievers = 0;
            for (const $tenant of this.#tenants) {
                // Note that we aren't excluding the event source at this level
                $tenant.postMessage(resolveMessage(e.data), {
                    eventOptions: { type: `broadcast:${this.channelID}` },
                    except: e.originalTarget, // but at the level of the originating MessagingOverSocket
                });
                if ($tenant !== tenant) {
                    recievers ++;
                }
            }
            return recievers; // ACK
        };
        // ----------
        // Auto cleanup
        // ----------
        const cleanup = () => {
            if (!this.#tenants.has(tenant)) return;
            this.#tenants.delete(tenant);
            this.$emit('remove', tenant);
            if (!this.#tenants.size) {
                this.dispatchEvent(new Event('close'));
                this.$emit('close');
            }
            // Notify participants
            for (const $tenant of this.#tenants) {
                $tenant.postMessage(resolveMessage({
                    event: 'leaves',
                }), { eventOptions: { type: `broadcast:${this.channelID}` } });
            }
            tenant.removeEventListener('close', cleanup);
            cleanupBroadcastHandler();
        };
        const cleanupBroadcastHandler = tenant.handleRequests(`broadcast:${this.channelID}`, broadcastHandler);
        tenant.addEventListener('close', cleanup);
        return cleanup;
    }

    findTenant(callback) {
        for (const tenant of this.#tenants) {
            if (callback(tenant)) {
                return tenant;
            }
        }
    }
}