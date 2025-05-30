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
                this.$emit('disconnected');
            }
            if (!_isObject(event.data) || !['eventID', 'data'].every((k) => k in event.data)) {
                return;
            }
            this.dispatchEvent(new ChannelMessageEvent(
                this, { ...event.data, ports: event.ports, }
            ));
        };
        this.#port.addEventListener('message', messageHandler);
        const nativeCloseMethod = this.#port.close;
        Object.defineProperty(this.#port, 'close', {
            value: () => {
                // This endpoint is closed
                this.#port.removeEventListener('message', messageHandler);
                this.dispatchEvent(new Event('close'));
                this.$destroy();
                this.$emit('disconnected');
                // Then post to the other end
                this.#port.postMessage('close');
                // Then restore nativeCloseMethod and execute normally
                Object.defineProperty(this.#port, 'close', { value: nativeCloseMethod, configurable: true });
                this.#port.close();
            }, configurable: true
        });
        if (!this.isPrimary) {
            // We are client
            this.#port.postMessage('connection');
            this.$emit('connected');
        }
    }

    postMessage(data, transferOrOptions = []) {
        return super.postMessageCallback(data, transferOrOptions, (options) => {
            const { eventOptions = {}, ...portOptions } = options;
            return this.#port.postMessage({
                ...eventOptions,
                data
            }, portOptions);
        });
    }

    dispatchLocal(eventOptions = {}) {
        this.dispatchEvent(new ChannelMessageEvent(
            this, eventOptions
        ));
    }

    close() {
        return this.#port.close();
    }
}

export class ChannelMessageEvent extends WebfloMessageEvent { }