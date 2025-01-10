import { _isObject } from '@webqit/util/js/index.js';
import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';

export class PortMessagingAPI extends WebfloMessagingAPI {

    #port;
    get port() { return this.#port; }

    constructor(port, isPrimary = false) {
        super();
        this.#port = port;
        this.#port.start?.();
        const messageHandler = async (event) => {
            if (isPrimary && event.data === 'connection') {
                this.$emit('connected');
            }
            if (event.data === 'close') {
                // Endpoint 2 is closed
                this.#port.removeEventListener('message', messageHandler);
                this.dispatchEvent(new Event('close'));
                this.$destroy();
            }
            if (!_isObject(event.data) || !['messageType', 'message'].every((k) => k in event.data)) {
                return;
            }
            this.dispatchEvent(new PortMessageEvent(
                event.data.messageType,
                event.data.message,
                event.ports
            ));
        };
        this.#port.addEventListener('message', messageHandler);
        const nativeCloseMethod = this.#port.close;
        Object.defineProperty(this.#port, 'close', { value: () => {
            // This endpoint is closed
            this.#port.removeEventListener('message', messageHandler);
            this.dispatchEvent(new Event('close'));
            this.$destroy();
            // Then post to the other end
            this.#port.postMessage('close');
            // Then restore nativeCloseMethod and execute normally
            Object.defineProperty(this.#port, 'close', { value: nativeCloseMethod });
            this.#port.close();
        }});
        if (!isPrimary) {
            // We are client
            this.$emit('connected');
            this.#port.postMessage('connection');
        }
    }

    postMessage(message, transferOrOptions = []) {
        this.on('connected', () => {
            if (Array.isArray(transferOrOptions)) {
                transferOrOptions = { transfer: transferOrOptions };
            }
            const { messageType = 'message', ...options } = transferOrOptions;
            return super.postMessage({
                messageType,
                message
            }, options);
        });
        super.postMessage(message, transferOrOptions);
    }
    
    close() {
        return this.#port.close();
    }
}

export class PortMessageEvent extends Event {

    #data;
    get data() { return this.#data; }

    #ports = [];
    get ports() { return this.#ports; }

    constructor(messageType, message, ports = []) {
        super(messageType);
        this.#data = message;
        this.#ports = ports;
    }

    respondWith(data, transferOrOptions = []) {
        for (const port of this.#ports) {
            port.postMessage(data, transferOrOptions);
        }
        return !!this.#ports.length;
    }
}