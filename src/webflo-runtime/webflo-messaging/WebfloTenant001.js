import { StarPort } from '@webqit/port-plus';
import { ClientRequestPort001 } from './ClientRequestPort001.js';

export class WebfloTenant001 extends StarPort {

    #tenantID;
    get tenantID() { return this.#tenantID; }

    constructor(tenantID, options = {}) {
        super(options);
        this.#tenantID = tenantID;
    }

    getRequestPort(portID) {
        return this.findPort((port) => port.portID === portID);
    }

    createRequestPort(portID, url = null) {
        const requestPort = new ClientRequestPort001(portID, url, { handshake: 1, postAwaitsOpen: true, autoClose: true });
        this.addPort(requestPort, { enableBubbling: true });

        setTimeout(() => {
            if (requestPort.length || !this.findPort((port) => port === requestPort)) return;
            if (requestPort.autoCloseXPromise) {
                requestPort.autoCloseXPromise.then(() => requestPort.close(true));
            } else requestPort.close(true);
        }, 30000/*30sec*/);

        return requestPort;
    }
}