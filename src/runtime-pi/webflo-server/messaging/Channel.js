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
        if (!this.isOpen() && this.#tenants.size === 2) {
            this.dispatchEvent(new Event('open'));
            this.$emit('open');
        }
        // Notify participants
        for (const $tenant of this.#tenants) {
            if ($tenant === tenant) continue;
            $tenant.postMessage(resolveMessage({
                channelID: this.channelID,
                event: 'joins',
            }), { eventOptions: { type: 'broadcast' } });
        }
        // Router messages
        const broadcastHandler = (e) => {
            if (e.data?.channelID !== this.#channelID) return;
            for (const $tenant of this.#tenants) {
                // Note that we aren't excluding the event source at this level
                $tenant.postMessage(resolveMessage(e.data), {
                    eventOptions: { type: 'broadcast' },
                    except: e.originalTarget, // but at the level of the originating MessagingOverSocket
                });
            }
        };
        // ----------
        // Auto cleanup
        // ----------
        const cleanup = () => {
            if (!this.#tenants.has(tenant)) return;
            this.#tenants.delete(tenant);
            this.$emit('remove', tenant);
            if (this.#tenants.size === 1) {
                this.dispatchEvent(new Event('close'));
                this.$emit('close');
            }
            // Notify participants
            for (const $tenant of this.#tenants) {
                $tenant.postMessage(resolveMessage({
                    channelID: this.channelID,
                    event: 'leaves',
                }), { eventOptions: { type: 'broadcast' } });
            }
            tenant.removeEventListener(`broadcast`, broadcastHandler);
            tenant.removeEventListener('close', cleanup);
        };
        tenant.addEventListener(`broadcast`, broadcastHandler);
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