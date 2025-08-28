import { preProcessPostMessage, portIsMessaging, portHooksCleanup } from './wq-message-port.js';
import { WQMessagePort } from './WQMessagePort.js';
import { _wq } from '../../util.js';

export class WQStarPort extends WQMessagePort {

    #ports = new Set;

    get length() { return this.#ports.size; }

    [Symbol.iterator]() { return this.#ports[Symbol.iterator](); }

    constructor() {
        super();
        this.#startWQLifecycle();
    }

    #startWQLifecycle() {
        const meta = _wq(this, 'meta');
        Object.defineProperty(this, 'wqLifecycle', {
            value: {
                open: new Promise((resolve) => {
                    if (meta.get('open')) return resolve();
                    meta.set('onlineCallback', resolve);
                }),
                close: new Promise((resolve) => {
                    if (meta.get('close')) return resolve();
                    meta.set('offlineCallback', resolve);
                }),
                messaging: new Promise((resolve) => {
                    if (meta.get('messaging')) return resolve();
                    meta.set('messagingCallback', resolve);
                }),
            },
            configurable: true
        });
    }

    addPort(port, { enableBubbling = true } = {}) {
        if (!(port instanceof WQMessagePort)) {
            throw new TypeError('Port must be a WQMessagePort instance.');
        }
        if (this.#ports.has(port)) return;
        this.#ports.add(port);              // @ORDER: 1
        const meta = _wq(this, 'meta');
        const portMeta = _wq(port, 'meta');
        if (enableBubbling) {
            if (portMeta.get('parentNode')) {
                throw new TypeError('Incoming port already has a parent node.');
            }
            portMeta.set('parentNode', this);   // @ORDER: 2
        }
        // Lifecycle management
        port.wqLifecycle.open.then(() => {
            if (meta.get('open')) return;
            this.dispatchEvent(new Event('open'));
            meta.get('onlineCallback')();
        });
        const cleanup = () => {
            if (!this.#ports.has(port)) return;
            this.#ports.delete(port);
            if (enableBubbling) {
                portMeta.set('parentNode', null);
            }
            if (this.#ports.size === 0) {
                this.dispatchEvent(new Event('close'));
                meta.get('offlineCallback')();
                this.#startWQLifecycle();
            }
        };
        port.wqLifecycle.close.then(cleanup);
        return cleanup;
    }

    findPort(callback) {
        for (const port of this.#ports) {
            if (callback(port)) {
                return port;
            }
        }
    }

    // --------

    postMessage(data, transferOrOptions = []) {
        portIsMessaging.call(this);
        this.wqLifecycle.open.then(() => {
            const { wqProcessingOptions, ...resstOptions } = preProcessPostMessage.call(this, data, transferOrOptions);
            for (const port of this.#ports) {
                if (port === wqProcessingOptions.except) continue;
                port.postMessage(data, { wqProcessingOptions, ...resstOptions });
            }
        });
    }

    close(destroy = false) {
        for (const port of this.#ports) {
            port.close?.();
        }
        if (destroy) {
            portHooksCleanup.call(this);
        }
    }
}
