import { WebfloMessageEvent } from './WebfloMessageEvent.js';
import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';

export class MessagingOverSocket extends WebfloMessagingAPI {

    static WebSocket = typeof WebSocket !== 'undefined' ? WebSocket : null;

    #socket;
    get socket() { return this.#socket; }

    constructor(parentNode, instanceOrConnectionID, params = {}) {
        super(parentNode, params);
        this.#socket = typeof instanceOrConnectionID === 'string' ? new this.constructor.WebSocket(`/${instanceOrConnectionID}`) : instanceOrConnectionID;
        const messageHandler = async (event) => {
            let json;
            try {
                if (!(json = JSON.parse(event.data)) 
                || !['eventID', 'data'].every((k) => k in json)) {
                    return;
                }
            } catch(e) {
                // throw a better error
            }
            const { data, dataUndefined, ...$json } = json;
            this.dispatchEvent(new SocketMessageEvent(
                this, { ...$json, data: dataUndefined ? undefined : data },
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
            this.$emit('disconnected');
        };
        this.#socket.addEventListener('message', messageHandler);
        this.#socket.addEventListener('open', openHandler);
        this.#socket.addEventListener('error', errorHandler);
        this.#socket.addEventListener('close', closeHandler);
        if (this.#socket.readyState === this.#socket.constructor.OPEN) {
            this.$emit('connected');
        }
    }

    postMessage(data, transferOrOptions = []) {
        return super.postMessageCallback(data, transferOrOptions, (options) => {
            const { transfer = [], eventOptions = {}, ...portOptions } = options;
            const messagePorts = transfer.filter((t) => t instanceof MessagePort);
            this.#socket.send(JSON.stringify({
                ...eventOptions,
                data: data === undefined ? null : data,
                dataUndefined: data === undefined,
                numPorts: messagePorts.length,
            }), portOptions);
            for (let i = 0; i < messagePorts.length; i ++) {
                this.addEventListener(`${eventOptions.type || 'message'}:${eventOptions.eventID}:${i}`, (event) => {
                    messagePorts[i].postMessage(event.data, event.ports);
                });
            }
        });
    }

    dispatchLocal(eventOptions = {}) {
        this.dispatchEvent(new SocketMessageEvent(
            this, eventOptions
        ));
    }

    close(...args) {
        return this.#socket.close(...args);
    }
}

export class SocketMessageEvent extends WebfloMessageEvent {
    constructor(originalTarget, { numPorts = 0, ports, ...eventOptions } = {}) {
        if (typeof numPorts !== 'number' || numPorts < 0) {
            throw new TypeError('numPorts must be a non-negative number');
        }
        if (ports) {
            throw new TypeError('Ports must not be manually specified for SocketMessageEvent, use eventOptions.numPorts instead');
        }
        eventOptions.ports = [];
        for (let i = 0; i < numPorts; i ++) {
            const channel = new MessageChannel;
            channel.port1.addEventListener('message', (event) => {
                this.originalTarget.postMessage(event.data, {
                    eventOptions: { type: `${eventOptions.type || 'message'}:${eventOptions.eventID}:${i}` },
                    transfer: event.ports,
                });
            });
            channel.port1.start();
            eventOptions.ports.push(channel.port2);
        }
        super(originalTarget, eventOptions);
    }
}