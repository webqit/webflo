import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';

export class SocketMessagingAPI extends WebfloMessagingAPI {

    #socket;
    get socket() { return this.#socket; }

    constructor(socket) {
        super();
        this.#socket = socket;
        const messageHandler = async (event) => {
            let json;
            try {
                if (!(json = JSON.parse(event.data)) 
                || !['messageType', 'messageID', 'message'].every((k) => k in json)) {
                    return;
                }
            } catch(e) {
                // throw a better error
            }
            this.dispatchEvent(new SocketMessageEvent(
                this,
                json.messageID,
                json.messageType,
                json.message,
                json.numPorts
            ));
        };
        const openHandler = (e) => {
            this.$emit('connected');
            this.dispatchEvent(new Event('open'));
        };
        const errorHandler = (e) => {
            this.dispatchEvent(new Event('error'));
        };
        const closeHandler = (e) => {
            this.#socket.removeEventListener('message', messageHandler);
            this.#socket.removeEventListener('open', openHandler);
            this.#socket.removeEventListener('error', errorHandler);
            this.#socket.removeEventListener('close', closeHandler);
            this.dispatchEvent(new Event('close'));
            this.$destroy();
        };
        this.#socket.addEventListener('message', messageHandler);
        this.#socket.addEventListener('open', openHandler);
        this.#socket.addEventListener('error', errorHandler);
        this.#socket.addEventListener('close', closeHandler);
        if (this.#socket.readyState === this.#socket.constructor.OPEN) {
            this.$emit('connected');
        }
    }

    postMessage(message, transferOrOptions = []) {
        this.on('connected', () => {
            if (Array.isArray(transferOrOptions)) {
                transferOrOptions = { transfer: transferOrOptions };
            }
            const { transfer = [], messageType = 'message', ...options } = transferOrOptions;
            const messagePorts = transfer.filter((t) => t instanceof MessagePort);
            const messageID = (0 | Math.random() * 9e6).toString(36);
            this.#socket.send(JSON.stringify({
                messageID,
                messageType,
                message,
                numPorts: messagePorts.length
            }), options);
            for (let i = 0; i < messagePorts.length; i ++) {
                this.addEventListener(`${messageType}:${messageID}:${i}`, (event) => {
                    messagePorts[i].postMessage(event.data, event.ports);
                });
            }
        });
        super.postMessage(message, transferOrOptions);
    }

    close(...args) {
        return this.#socket.close(...args);
    }
}

export class SocketMessageEvent extends Event {

    #messageID;
    get messageID() { return this.#messageID; }

    #data;
    get data() { return this.#data; }

    #ports = [];
    get ports() { return this.#ports; }

    #ownerAPI;
    constructor(ownerAPI, messageID, messageType, message, numPorts = 0) {
        super(messageType);
        this.#ownerAPI = ownerAPI;
        this.#messageID = messageID;
        this.#data = message;
        for (let i = 0; i < numPorts; i ++) {
            const channel = new MessageChannel;
            channel.port1.addEventListener('message', (event) => {
                this.#ownerAPI.postMessage(event.data, {
                    messageType: `${messageType}:${messageID}:${i}`,
                    transfer: event.ports
                });
            });
            channel.port1.start();
            this.#ports.push(channel.port2);
        }
    }

    respondWith(data, transferOrOptions = []) {
        for (const port of this.#ports) {
            port.postMessage(data, transferOrOptions);
        }
        return !!this.#ports.length;
    }
}