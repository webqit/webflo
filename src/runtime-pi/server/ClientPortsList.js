import { ClientPort } from './ClientPort.js';
import crypto from 'crypto';

export class ClientPortsList extends Map {

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
        const portID = crypto.randomUUID();
        const portInstance = new ClientPort(this, portID, this.#params);
        this.set(portID, portInstance);
        portInstance.on('empty', () => {
            this.delete(portID);
        });
        setTimeout(() => {
            if (portInstance.length || !this.has(portID)) return;
            this.delete(portID);
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