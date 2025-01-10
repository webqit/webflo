import { ClientPort as BaseClientPort } from '../ClientPort.js';

export class ClientPort extends BaseClientPort {

    #portID;
    get portID() { return this.#portID; }

    #params;
    get params() { return this.#params; }

    constructor(portID, params = {}) {
        const port = new BroadcastChannel(portID);
        super(port, true);
        this.#portID = portID;
        this.#params = params;
    }
}