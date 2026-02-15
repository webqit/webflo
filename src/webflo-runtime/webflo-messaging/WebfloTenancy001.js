import { StarPort, RelayPort } from '@webqit/port-plus';
import { WebfloTenant001 } from './WebfloTenant001.js';

export class WebfloTenancy001 extends StarPort {

    #channels = new Map;

    constructor() {
        super({ handshake: 1, postAwaitsOpen: true, autoClose: false });
    }

    getTenant(tenantID, autoCreate = false) {
        let tenant = this.findPort((tenant) => tenant.tenantID === tenantID);

        if (!tenant && autoCreate) {
            tenant = new WebfloTenant001(tenantID, { handshake: 1, postAwaitsOpen: true, autoClose: true });
            this.addPort(tenant, { enableBubbling: true }); // auto-removed on close - given that handshake is 1, above
        }

        return tenant;
    }

    getChannel(channelName, autoCreate = false) {
        let channel = this.#channels.get(channelName);

        if (!channel && autoCreate) {
            channel = new RelayPort(channelName, { handshake: 1, postAwaitsOpen: true, autoClose: true });

            this.#channels.set(channelName, channel);
            channel.readyStateChange('close').then(() => this.#channels.delete(channelName));
        }
        
        return channel;
    }
}