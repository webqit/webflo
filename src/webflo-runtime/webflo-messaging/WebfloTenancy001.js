import { RelayPort, StarPort } from '@webqit/port-plus';
import { WebfloTenant001 } from './WebfloTenant001.js';

export class WebfloTenancy001 extends StarPort {

    #channels = new Map;

    getTenant(tenantID, autoCreate = false) {
        if (autoCreate && !this.findPort((tenant) => tenant.tenantID === tenantID)) {
            const tenant = new WebfloTenant001(tenantID, { handshake: 1, postAwaitsOpen: true, autoClose: false });
            const cleanup = this.addPort(tenant);
            tenant.readyStateChange('close').then(cleanup);
        }
        return this.findPort((tenant) => tenant.tenantID === tenantID);
    }

    getChannel(channelName, autoCreate = false) {
        if (!this.#channels.has(channelName) && autoCreate) {
            const channel = new RelayPort(channelName, { handshake: 1, postAwaitsOpen: true, autoClose: true });

            this.#channels.set(channelName, channel);
            channel.readyStateChange('close').then(() => this.#channels.delete(channelName));
        }
        
        return this.#channels.get(channelName);
    }
}