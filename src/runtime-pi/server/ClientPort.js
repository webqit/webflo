import { MultiportMessagingAPI } from '../MultiportMessagingAPI.js';

export class ClientPort extends MultiportMessagingAPI {

    #manager;
    
    #portID;
    get portID() { return this.#portID; }

    constructor(manager, portID, params = {}) {
        super(params);
        this.#manager = manager;
        this.#portID = portID;
    }

    createBroadcastChannel(name) {
        return this.#manager.createBroadcastChannel(name);
    }
}
