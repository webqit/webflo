import { ClientMessaging } from './ClientMessaging.js';
import crypto from 'crypto';

export class ClientMessagingRegistry extends Map {

    #parentNode;
    get parentNode() { return this.#parentNode; }

    #sessionID;
    get sessionID() { return this.#sessionID; }

    #params;
    get params() { return this.#params; }

    #channels = new Map;

    constructor(parentNode/*WebfloServer*/, sessionID, params = {}) {
        super();
        this.#parentNode = parentNode;
        this.#sessionID = sessionID;
        this.#params = params;
    }

    createPort() {
        const portID = crypto.randomUUID();
        const portInstance = new ClientMessaging(this, portID, this.#params);
        this.set(portID, portInstance);
        portInstance.on('empty', () => {
            this.delete(portID);
        });
        setTimeout(() => {
            if (portInstance.ports.size || !this.has(portID)) return;
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