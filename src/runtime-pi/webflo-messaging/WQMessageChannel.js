import { toWQPort } from './wq-message-port.js';

export class WQMessageChannel extends MessageChannel {

    #port1;
    get port1() {
        if (!this.#port1) {
            this.#port1 = super.port1;
            this.#port1.start();
            toWQPort(this.#port1);
        }
        return this.#port1;
    }

    #port2;
    get port2() {
        if (!this.#port2) {
            this.#port2 = super.port2;
            this.#port2.start();
            toWQPort(this.#port2);
        }
        return this.#port2;
    }
}

globalThis.WQMessageChannel = WQMessageChannel;
