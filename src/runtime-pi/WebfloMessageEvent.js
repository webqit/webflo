
export class WebfloMessageEvent extends Event {

    #originalTarget;
    get originalTarget() { return this.#originalTarget; }

    get runtime() {
        let parentNode = this.#originalTarget;
        do {
            if (parentNode.runtime) return parentNode.runtime;
        } while (parentNode = parentNode.parentNode)
    }

    #data;
    get data() { return this.#data; }

    #ports = [];
    get ports() { return this.#ports; }

    constructor(originalTarget, messageType, message, ports) {
        super(messageType);
        this.#originalTarget = originalTarget;
        this.#data = message;
        this.#ports = ports;
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