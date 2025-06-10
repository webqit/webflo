import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';
import { $parentNode } from '../../util.js';

export class MultiportMessagingAPI extends WebfloMessagingAPI {

    #ports = new Set;
    get ports() { return this.#ports; }

    [Symbol.iterator]() { return this.#ports[Symbol.iterator](); }

    addPort(port) {
        if (!(port instanceof WebfloMessagingAPI)) {
            throw new TypeError('Port must be a Webflo messaging API');
        }
        if (this.#ports.has(port)) return;
        // Lifecycle management
        this.#ports.add(port);      // @ORDER: 1
        port[$parentNode] = this;   // @ORDER: 2
        this.$emit('add', port);
        if (!this.isOpen()) {
            this.dispatchEvent(new Event('open'));
            this.$emit('open');
        }
        // ----------
        // Auto cleanup
        // ----------
        const cleanup = () => {
            if (!this.#ports.has(port)) return;
            if (port[$parentNode] === this) {
                port[$parentNode] = null;
            }
            this.#ports.delete(port);
            this.$emit('remove', port);
            if (this.#ports.size === 0) {
                this.dispatchEvent(new Event('close'));
                this.$emit('close');
            }
            port.removeEventListener('close', cleanup);
        };
        port.addEventListener('close', cleanup);
        return cleanup;
    }

    findPort(callback) {
        for (const port of this.#ports) {
            if (callback(port)) {
                return port;
            }
        }
    }

    /* ----------------- */

    postMessage(message, transferOrOptions = []) {
        return super.postMessageCallback(message, transferOrOptions, (options) => {
            for (const port of this.#ports) {
                if (port === options.except) continue;
                port.postMessage(message, options);
            }
        });
    }

    close(...args) {
        for (const port of this.#ports) {
            port.close?.(...args);
        }
    }
}