import { _isTypeObject } from '@webqit/util/js/index.js';

export class WebfloMessageEvent extends Event {

    #originalTarget;
    get originalTarget() { return this.#originalTarget; }

    get runtime() {
        let parentNode = this.#originalTarget;
        do {
            if (parentNode.runtime) return parentNode.runtime;
        } while (parentNode = parentNode.parentNode)
    }

    #eventID;
    get eventID() { return this.#eventID; }

    #data;
    get data() { return this.#data; }

    #live;
    get live() { return this.#live; }

    #bubbles;
    get bubbles() { return this.#bubbles; }

    #ports = [];
    get ports() { return this.#ports; }

    constructor(originalTarget, { eventID, type = 'message', data = null, live = false, bubbles = false, ports = [] } = {}) {
        if (typeof eventID !== 'string') {
            throw new TypeError('eventID must be a non-empty string');
        }
        if (type && typeof type !== 'string') {
            throw new TypeError('Where specified, eventOptions.type must be a string');
        }
        super(type);
        this.#originalTarget = originalTarget;
        this.#eventID = eventID;
        this.#data = data;
        this.#live = live;
        this.#bubbles = bubbles;
        this.#ports = ports;
        if (_isTypeObject(this.#data) && this.#live && typeof this.#originalTarget?.applyMutations === 'function') {
            // If the data is a live object, we can apply mutations to it
            this.#originalTarget.applyMutations(this.#data, this.#eventID);
        }
    }

    #immediatePropagationStopped = false;
    get immediatePropagationStopped() { return this.#immediatePropagationStopped; }

    stopImmediatePropagation() {
        this.#immediatePropagationStopped = true;
        this.#propagationStopped = true;
        super.stopImmediatePropagation();
    }

    #propagationStopped = false;
    get propagationStopped() { return this.#propagationStopped; }

    stopPropagation() {
        this.#propagationStopped = true;
        super.stopPropagation();
    }

    #defaultPrevented = false;
    get defaultPrevented() { return this.#defaultPrevented; }

    preventDefault() {
        this.#defaultPrevented = true;
        super.preventDefault();
    }

    respondWith(data, transferOrOptions = []) {
        for (const port of this.ports) {
            port.postMessage(data, transferOrOptions);
        }
        return !!this.ports.length;
    }
}