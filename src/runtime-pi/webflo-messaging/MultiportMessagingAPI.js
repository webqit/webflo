import { WebfloMessagingAPI } from './WebfloMessagingAPI.js';

export class MultiportMessagingAPI extends WebfloMessagingAPI {

    get runtime() { return this.params.runtime || this.parentNode; }

    #ports = new Set;
    get ports() { return this.#ports; }

    [ Symbol.iterator ]() { return this.#ports[ Symbol.iterator ](); }

    add(port) {
        if (!(port instanceof WebfloMessagingAPI)) {
            throw new TypeError('Argument must be a Webflo messaging interface');
        }
        port.setParent(this, true);
        this.#ports.add(port);
        this.$emit('add', port);
        if (!this.isConnected()) {
            this.$emit('connected');
        }
        port.addEventListener('close', () => {
            this.remove(port);
        }, { once: true });
    }

    remove(port) {
        if (port.parentNode === this) {
            port.setParent(null);
        }
        this.#ports.delete(port);
        this.$emit('remove', port);
        if (!this.#isReplaceAction && this.#ports.size === 0) {
            this.$emit('disconnected');
        }
    }

    #isReplaceAction;
    replace(port) {
        this.#isReplaceAction = true;
        for (const port of this.#ports) {
            this.remove(port);
        }
        this.#isReplaceAction = false;
        this.add(port);
    }

    get(index, callback = null) {
        const _leadMax = this.#ports.size - 1;
        if (index > _leadMax && callback) {
            return this.on('add', () => this.get(index, callback), { once: true });
        }
        const port = [...this.#ports][index];
        if (callback) {
            callback(port);
        } else return port;
    }

    /* ----------------- */

    postMessage(message, transferOrOptions = []) {
        return super.postMessageCallback(message, transferOrOptions, (options) => {
            for (const port of this.#ports) {
                port.postMessage(message, options);
            }
        });
    }

    close(...args) {
        for (const port of this.#ports) {
            port.close?.(...args);
        }
    }

    /* ----------------- */

    createBroadcastChannel(name) {
        return new BroadcastChannel(name);
    }
}