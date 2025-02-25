import { WebfloMessageEvent } from './WebfloMessageEvent.js';
import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';

export class MessagingOverSocket extends WebfloMessagingAPI {

    #socket;
    get socket() { return this.#socket; }

    constructor(parentNode, instanceOrConnectionID, params = {}) {
        super(parentNode, params);
        this.#socket = typeof instanceOrConnectionID === 'string' ? new WebSocket(`/${instanceOrConnectionID}`) : instanceOrConnectionID;
        const messageHandler = async (event) => {
            let json;
            try {
                if (!(json = JSON.parse(event.data)) 
                || !['messageType', 'message', 'messageID'].every((k) => k in json)) {
                    return;
                }
            } catch(e) {
                // throw a better error
            }
            this.dispatchEvent(new SocketMessageEvent(
                this,
                json.messageType,
                json.messageUndefined ? undefined : json.message,
                json.messageID,
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
                messageType,
                message: message === undefined ? null : message,
                messageUndefined: message === undefined,
                messageID,
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

    fire(messageType, message) {
        this.dispatchEvent(new SocketMessageEvent(
            this,
            messageType,
            message
        ));
    }

    close(...args) {
        return this.#socket.close(...args);
    }
}

export class SocketMessageEvent extends WebfloMessageEvent {
    constructor(originalTarget, messageType, message, messageID = null, numPorts = 0) {
        const ports = [];
        for (let i = 0; i < numPorts; i ++) {
            const channel = new MessageChannel;
            channel.port1.addEventListener('message', (event) => {
                this.originalTarget.postMessage(event.data, {
                    messageType: `${messageType}:${messageID}:${i}`,
                    transfer: event.ports
                });
            });
            channel.port1.start();
            ports.push(channel.port2);
        }
        super(originalTarget, messageType, message, ports);
    }
}