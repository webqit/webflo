import { MultiportMessagingAPI } from '../messaging-apis/MultiportMessagingAPI.js';

export class ClientMessaging extends MultiportMessagingAPI {

    get runtime() { return this.parentNode.parentNode; }

    #portID;
    get portID() { return this.#portID; }

    constructor(parentNode/*ClientMessagingRegistry*/, portID, params = {}) {
        super(parentNode, params);
        this.#portID = portID;
    }

    createBroadcastChannel(name) {
        return this.parentNode.createBroadcastChannel(name);
    }
}
