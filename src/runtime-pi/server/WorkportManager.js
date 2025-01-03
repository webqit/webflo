import { Workport } from './Workport.js';

export class WorkportManager extends Map {

    #sessionID;
    get sessionID() { return this.#sessionID; }

    #params;

    #channels = new Map;

    constructor(sessionID, params = {}) {
        super();
        this.#sessionID = sessionID;
        this.#params = params;
    }

    createPort() {
        const portID = (0 | Math.random() * 9e6).toString(36);
        const portInstance = new Workport(this, portID, this.#params);
        this.set(portID, portInstance);
        portInstance.onStateChange('disconnected', () => {
            this.delete(portID);
        });
        setTimeout(() => {
            if (!portInstance.connection() && this.has(portID)) {
                this.delete(portID);
            }
        }, 10000/*10sec*/);
        return portInstance;
    }

    createBroadcastChannel(name) {
        if (!this.#channels.has(name)) {
            this.#channels.set(name, new BroadcastChannel(this, name));
        }
        return this.#channels.get(name);
    }
}

export class BroadcastChannel extends EventTarget {
    #manager;
    #name;
    constructor(manager, name) {
        super();
        this.#manager = manager;
        this.#name = name;
    }

    postMessage() {
    }
}