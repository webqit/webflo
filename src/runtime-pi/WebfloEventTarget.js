export class WebfloEventTarget extends EventTarget {

    #parentNode;
    #params;
    #listenersRegistry = new Set;

    get parentNode() { return this.#parentNode; }
    get params() { return this.#params; }
    get length() { return this.#listenersRegistry.size; }

    constructor(parentNode, params = {}) {
        super();
        this.#parentNode = parentNode;
        this.#params = params;
    }

    setParent(parentNode) {
        this.#parentNode = parentNode;
    }

    dispatchEvent(event) {
        const returnValue = super.dispatchEvent(event);
        if (this.#parentNode instanceof EventTarget && !event.defaultPrevented && !event.propagationStopped) {
            this.#parentNode.dispatchEvent(event);
        }
        return returnValue;
    }

    addEventListener(...args) {
        this.#listenersRegistry.add(args);
        return super.addEventListener(...args);
    }

    $destroy() {
        for (const listenerArgs of this.#listenersRegistry) {
            this.removeEventListener(...listenerArgs);
        }
    }
}