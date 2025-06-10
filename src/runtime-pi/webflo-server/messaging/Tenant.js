import { MultiportMessagingAPI } from '../../webflo-messaging/MultiportMessagingAPI.js';
import { ClientMessagePort } from './ClientMessagePort.js';
import crypto from 'crypto';

export class Tenant extends MultiportMessagingAPI {

    #tenantID;
    get tenantID() { return this.#tenantID; }

    constructor(parentNode, tenantID, params = {}) {
        super(parentNode, params);
        this.#tenantID = tenantID;
    }

    getPort(portID) {
        return this.findPort((port) => port.portID === portID);
    }

    createPort({ url = null, honourDoneMutationFlags = false } = {}) {
        const portID = crypto.randomUUID();
        const portInstance = new ClientMessagePort(this, portID, { url, honourDoneMutationFlags });
        const cleanup = this.addPort(portInstance);
        setTimeout(() => {
            if (portInstance.ports.size || !this.ports.has(portInstance)) return;
            cleanup();
        }, 30000/*30sec*/);
        return portInstance;
    }
}