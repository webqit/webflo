import { AbstractWorkport } from '../AbstractWorkport.js';

export class Workport extends AbstractWorkport {

    #manager;
    
    #portID;
    get portID() { return this.#portID; }

    constructor(manager, portID, params = {}) {
        super(undefined, params);
        this.#manager = manager;
        this.#portID = portID;
    }

    createBroadcastChannel(name) {
        return this.#manager.createBroadcastChannel(name);
    }
}
