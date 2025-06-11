import crypto from 'crypto';
import { MultiportMessagingAPI } from '../../webflo-messaging/MultiportMessagingAPI.js';
import { $parentNode } from '../../../util.js';
import { Channel } from './Channel.js';
import { Tenant } from './Tenant.js';

export class Tenants extends MultiportMessagingAPI {
    #channels = new Map;

    identifyIncoming(request, autoGenerateID = false) {
        const secret = this[$parentNode].env('SESSION_KEY');
        let tenantID = request.headers.get('Cookie', true).find((c) => c.name === '__sessid')?.value;
        if (tenantID?.includes('.')) {
            if (secret) {
                const [rand, signature] = tenantID.split('.');
                const expectedSignature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                if (signature !== expectedSignature) {
                    tenantID = null;
                }
            } else {
                tenantID = null;
            }
        }
        if (!tenantID && autoGenerateID) {
            if (secret) {
                const rand = `${(0 | Math.random() * 9e6).toString(36)}`;
                const signature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                tenantID = `${rand}.${signature}`
            } else {
                tenantID = crypto.randomUUID();
            }
        }
        return tenantID;
    }

    getTenant(tenantID, autoCreate = false, params = {}) {
        if (autoCreate && !this.findPort((tenant) => tenant.tenantID === tenantID)) {
            const tenant = new Tenant(this, tenantID, params);
            const cleanup = this.addPort(tenant);
            tenant.on('close', cleanup);
        }
        return this.findPort((tenant) => tenant.tenantID === tenantID);
    }

    getChannel(channelID, autoCreate = false, params = {}) {
        if (!this.#channels.has(channelID) && autoCreate) {
            const channel = new Channel(this, channelID, params);
            this.#channels.set(channelID, channel);
            channel.on('close', () => this.#channels.delete(channelID));
        }
        return this.#channels.get(channelID);
    }
}