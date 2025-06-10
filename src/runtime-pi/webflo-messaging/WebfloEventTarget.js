import { $parentNode, $runtime } from '../../util.js';
import { WebfloMessageEvent } from './WebfloMessageEvent.js';

export class WebfloEventTarget extends EventTarget {

    #parentNode;
    #alwaysBubbleToParent = false;
    #params;
    #listenersRegistry = new Set;

    set [$parentNode](parentNode) {
        this.#parentNode = parentNode;
        this.#alwaysBubbleToParent = parentNode?.ports?.has(this);
    }

    get [$parentNode]() { return this.#parentNode; }

    get [$runtime]() { return this[$parentNode]?.[$runtime]; }

    get params() { return this.#params; }

    get length() { return this.#listenersRegistry.size; }

    constructor(parentNode, params = {}) {
        super();
        this.#parentNode = parentNode;
        this.#alwaysBubbleToParent = parentNode?.ports?.has(this);
        this.#params = params;
    }

    dispatchEvent(event) {
        const returnValue = super.dispatchEvent(event);
        if ((event.bubbles || this.#alwaysBubbleToParent && event instanceof WebfloMessageEvent)
            && this.#parentNode instanceof EventTarget && !event.propagationStopped) {
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