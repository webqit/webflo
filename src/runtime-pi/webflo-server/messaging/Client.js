import { WQStarPort } from '../../webflo-messaging/WQStarPort.js';
import { ClientRequestRealtime } from './ClientRequestRealtime.js';

export class Client extends WQStarPort {

    #clientID;
    get clientID() { return this.#clientID; }

    constructor(clientID) {
        super();
        this.#clientID = clientID;
    }

    getRequestRealtime(portID) {
        return this.findPort((port) => port.portID === portID);
    }

    createRequestRealtime(portID, url = null) {
        const requestPort = new ClientRequestRealtime(portID, url);
        this.addPort(requestPort);
        setTimeout(() => {
            if (requestPort.length || !this.findPort((port) => port === requestPort)) return;
            requestPort.close(true);
        }, 15000/*15sec*/);
        return requestPort;
    }
}