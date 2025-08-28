import { WQStarPort } from '../../webflo-messaging/WQStarPort.js';
import { WQRelayPort } from '../../webflo-messaging/WQRelayPort.js';
import { Client } from './Client.js';

export class Clients extends WQStarPort {
    #channels = new Map;

    getClient(clientID, autoCreate = false) {
        if (autoCreate && !this.findPort((client) => client.clientID === clientID)) {
            const client = new Client(clientID);
            const cleanup = this.addPort(client);
            client.wqLifecycle.close.then(cleanup);
        }
        return this.findPort((client) => client.clientID === clientID);
    }

    getChannel(channelName, autoCreate = false) {
        if (!this.#channels.has(channelName) && autoCreate) {
            const channel = new WQRelayPort(channelName);
            this.#channels.set(channelName, channel);
            channel.wqLifecycle.close.then(() => this.#channels.delete(channelName));
        }
        return this.#channels.get(channelName);
    }
}