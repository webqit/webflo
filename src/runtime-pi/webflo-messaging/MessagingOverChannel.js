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
        const fireOpen = () => {
            this.dispatchEvent(new Event('open'));
            this.$emit('open');
        };
        const fireClose = () => {
            this.dispatchEvent(new Event('close'));
            this.$emit('close');
        };
        if (!this.isPrimary) {
            // We are client
            this.#port.postMessage('connection'); // Goes first
            fireOpen();
        }
        // Message handling
        const handleMessage = async (event) => {
            if (this.isPrimary && event.data === 'connection') {
                fireOpen();
            }
            if (event.data === 'disconnection') {
                // Endpoint 2 is closed
                this.#port.removeEventListener('message', handleMessage);
                fireClose();
                this.$destroy();
            }
            if (!_isObject(event.data) || !['eventID', 'data'].every((k) => k in event.data)) {
                return;
            }
            this.dispatchEvent(new ChannelMessageEvent(
                this, { ...event.data, ports: event.ports, }
            ));
        };
        this.#port.addEventListener('message', handleMessage);
        // Special close handling
        const handleClose = () => {
            // This endpoint is closed
            this.#port.removeEventListener('message', handleMessage);
            fireClose()
            this.$destroy();
            // Then post to the other end
            this.#port.postMessage('disconnection'); // Goes last, i think
        };
        const nativeCloseMethod = this.#port.close;
        Object.defineProperty(this.#port, 'close', {
            value: function () {
                handleClose();
                // Then execute normally and restore nativeCloseMethod 
                nativeCloseMethod.call(this);
                Object.defineProperty(this, 'close', { value: nativeCloseMethod, configurable: true });
            },
            configurable: true
        });
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