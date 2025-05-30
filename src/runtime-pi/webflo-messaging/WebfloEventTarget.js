export class WebfloEventTarget extends EventTarget {

    #parentNode;
    #alwaysBubbleToParent = false;
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

    setParent(parentNode, alwaysBubble = false) {
        this.#parentNode = parentNode;
        this.#alwaysBubbleToParent = alwaysBubble;
    }

    dispatchEvent(event) {
        const returnValue = super.dispatchEvent(event);
        if ((event.bubbles || this.#alwaysBubbleToParent) && this.#parentNode instanceof EventTarget && !event.defaultPrevented && !event.propagationStopped) {
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
        this.#listenersRegistry.clear();
    }
}