import { _isObject } from '@webqit/util/js/index.js';
import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';
import { WebfloMessageEvent } from './WebfloMessageEvent.js';

export class MessagingOverChannel extends WebfloMessagingAPI {

    #port;
    get port() { return this.#port; }

    #isPrimary;
    get isPrimary() { return this.#isPrimary; }

    constructor(parentNode, port, { isPrimary = false, ...params } = {}) {
        super(parentNode, params);
        this.#port = port;
        this.#isPrimary = isPrimary;
        this.#port.start?.();
        const messageHandler = async (event) => {
            if (this.isPrimary && event.data === 'connection') {
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
            this.dispatchEvent(new ChannelMessageEvent(
                this,
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
            Object.defineProperty(this.#port, 'close', { value: nativeCloseMethod, configurable: true });
            this.#port.close();
        }, configurable: true });
        if (!this.isPrimary) {
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
            return this.#port.postMessage({
                messageType,
                message
            }, options);
        });
        super.postMessage(message, transferOrOptions);
    }

    fire(messageType, message) {
        this.dispatchEvent(new ChannelMessageEvent(
            this,
            messageType,
            message
        ));
    }
    
    close() {
        return this.#port.close();
    }
}

export class ChannelMessageEvent extends WebfloMessageEvent {}