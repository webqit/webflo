export class WebfloEventTarget extends EventTarget {

    #parent;
    setParent(parent) {
        this.#parent = parent;
    }

    parentIs(node) {
        return this.#parent === node;
    }

    dispatchEvent(event) {
        const returnValue = super.dispatchEvent(event);
        if (this.#parent && !event.defaultPrevented) {
            this.#parent.dispatchEvent(event);
        }
        return returnValue;
    }

    #listenersRegistry = new Set;
    get length() { return this.#listenersRegistry.size; }

    addEventListener(...args) {
        this.#listenersRegistry.add(args);
        return super.addEventListener(...args);
    }

    $destroy() {
        for (const listenerArgs of this.#listenersRegistry) {
            this.removeEventListener(...listenerArgs);
        }
        this.#parent = null;
    }
}