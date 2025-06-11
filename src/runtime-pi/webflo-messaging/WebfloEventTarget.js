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

    #upstreams = new Set;

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
        if (!event.propagationStopped && this.#upstreams.size) {
            if (event instanceof WebfloMessageEvent) {
                const { type, eventID, data, live, bubbles, ports } = event;
                for (const target of this.#upstreams) {
                    target.postMessage(data, {
                        transfers: ports,
                        eventOptions: { type, eventID, bubbles, live, isPiping: true }
                    });
                }
            } else if (event.type === 'close') {
                for (const target of this.#upstreams) {
                    target.close();
                }
            }
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

    pipe(eventTarget, twoWay = false) {
        if (this.#upstreams.has(eventTarget)) {
            return;
        }
        this.#upstreams.add(eventTarget);
        let cleanup2;
        if (twoWay) {
            cleanup2 = eventTarget.pipe(this);
        }
        return () => {
            this.#upstreams.delete(eventTarget);
            cleanup2?.();
        };
    }
}