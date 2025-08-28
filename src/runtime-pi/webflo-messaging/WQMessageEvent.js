import { _isTypeObject } from '@webqit/util/js/index.js';
import { toWQPort, applyMutations } from './wq-message-port.js';
import { _wq } from '../../util.js';

export class WQMessageEvent extends Event {

    #originalTarget;
    get originalTarget() { return this.#originalTarget; }

    #eventID;
    get eventID() { return this.#eventID; }

    #data;
    get data() { return this.#data; }

    #live;
    get live() { return this.#live; }

    #bubbles;
    get bubbles() { return this.#bubbles; }

    #forwarded;
    get forwarded() { return this.#forwarded; }

    #ports = [];
    get ports() { return this.#ports; }

    constructor(originalTarget, {
        data = null,
        wqEventOptions: { eventID, type = 'message', live = false, bubbles = false, forwarded = false } = {},
        wqProcessingOptions: {} = {},
        ports = []
    } = {}) {
        if (typeof eventID !== 'string') {
            throw new TypeError('eventID must be a non-empty string');
        }
        if (type && typeof type !== 'string') {
            throw new TypeError('Where specified, wqEventOptions.type must be a string');
        }
        super(type);
        this.#originalTarget = originalTarget;
        this.#eventID = eventID;
        this.#data = data;
        this.#live = live;
        this.#bubbles = bubbles;
        this.#forwarded = forwarded;
        this.#ports = ports.map(toWQPort);
        if (_isTypeObject(this.#data) && this.#live) {
            // If the data is a live object, we can apply mutations to it
            applyMutations.call(originalTarget, this.#data, this.#eventID);
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

    wqRespondWith(data, transferOrOptions = []) {
        for (const port of this.#ports) {
            port.postMessage(data, transferOrOptions);
        }
        return !!this.#ports.length;
    }
}

globalThis.WQMessageEvent = WQMessageEvent;
