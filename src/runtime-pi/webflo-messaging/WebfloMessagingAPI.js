import { _difference } from '@webqit/util/arr/index.js';
import { _isTypeObject } from '@webqit/util/js/index.js';
import { WebfloEventTarget } from './WebfloEventTarget.js';
import { isTypeStream } from '../webflo-fetch/util.js';
import { Observer } from '@webqit/quantum-js';

export class WebfloMessagingAPI extends WebfloEventTarget {

    #hooks = new Set;
    get $hooks() { return this.#hooks; }

    #isOpen = undefined/*!IMPORTANT*/;
    isOpen() { return this.#isOpen; }

    #isMessaging = false;
    isMessaging() { return this.#isMessaging; }

    get ready() {
        return new Promise((resolve) => {
            this.on('open', resolve, { once: true });
        });
    }

    on(eventName, callback, { once = false } = {}) {
        if ((eventName === 'open' && this.isOpen()) ||
            (eventName === 'close' && this.isOpen() === false) ||
            (eventName === 'messaging' && this.isMessaging())) {
            callback();
            if (once) {
                return;
            }
        }
        const hook = { eventName, callback, once };
        this.#hooks.add(hook);
        return () => this.#hooks.delete(hook);
    }

    $emit(eventName, arg) {
        if (eventName === 'open') {
            this.#isOpen = true;
        } else if (eventName === 'close') {
            this.#isOpen = false;
        } else if (eventName === 'messaging') {
            this.#isMessaging = true;
        }
        for (const hook of this.#hooks) {
            if (hook.eventName !== eventName) continue;
            hook.callback(arg);
            if (hook.once) {
                this.#hooks.delete(hook);
            }
        }
    }

    /* ----------------- */

    #eventIDCounter = 0;
    get nextEventID() {
        return `live-${++this.#eventIDCounter}`;
        return (0 | Math.random() * 9e6).toString(36);
    }

    /**
     * transferOrOptions has the following structure:
     * {
     *   eventOptions: {
     *     eventID: String,         // Optional, this is the ID of the event
     *     type: String,            // The type of the event, e.g. 'message', 'request', 'mutations'
     *     live: Boolean,           // If true, the data is to be transmitted as a live object
     *     bubbles: Boolean,        // If true, the message bubbles up through the event system
     *   },
     *   liveOptions: {
     *     signal: AbortSignal,     // Optional signal to abort the live object
     *     withArrayMethodDescriptors: Boolean, // If true, array method descriptors are included in mutations
     *   },
     *   ...portOptions             // Any other options that should be passed to the postMessage method
     *   transfer: Array<Transferable>,
     * }
     */

    postMessageCallback(data, transferOrOptions, callback) {
        if (!this.isMessaging()) {
            this.$emit('messaging');
        }
        if (Array.isArray(transferOrOptions)) {
            transferOrOptions = { transfer: transferOrOptions };
        } else if (!transferOrOptions || typeof transferOrOptions !== 'object') {
            throw new TypeError('transferOrOptions must be an array or an object');
        }
        if (transferOrOptions.eventOptions?.eventID) {
            // Live messages would already have been handled if this is a child port of MultiportMessagingAPI,
            // so we don't need to handle them here. The parent port would have handled them.
            callback(transferOrOptions);
            return;
        }
        let { eventOptions = {}, liveOptions = {}, ..._options } = transferOrOptions;
        if (!eventOptions.eventID) {
            eventOptions = { ...eventOptions, eventID: this.nextEventID };
        }
        this.on('open', () => callback({ ..._options, eventOptions }), { once: true });
        if (_isTypeObject(data) && eventOptions.live && !eventOptions.type?.endsWith('.mutate')) {
            return this.publishMutations(data, eventOptions.eventID, liveOptions);
        }
    }

    postRequest(data, callback, options = {}) {
        const { eventOptions2 = {}, transfer = [], ...$options } = options;
        const { signal, once } = eventOptions2;
        const messageChannel = new MessageChannel;
        messageChannel.port1.addEventListener('message', (e) => callback(e), { signal, once });
        messageChannel.port1.start();
        return this.postMessage(data, { ...$options, transfer: [messageChannel.port2].concat(transfer) });
    }

    /* ----------------- */

    handleMessages(type, listener, options = {}) {
        this.addEventListener(type, listener, options);
        return () => {
            this.removeEventListener(type, listener, options);
        };
    }

    handleRequests(type, listener, options = {}) {
        return this.handleMessages(type, async (e) => {
            const response = await listener(e);
            for (const p of e.ports) {
                p.postMessage(response);
            }
        }, options);
    }

    /* ----------------- */

    #mutationListeners = new Set;
    get mutationListeners() { return this.#mutationListeners; }

    publishMutations(data, originalEventID, { signal, withArrayMethodDescriptors = true } = {}) {
        if (isTypeStream(data) || !_isTypeObject(data)) {
            throw new TypeError('data must be a plain object and not a stream');
        }
        if (typeof originalEventID !== 'string') {
            throw new TypeError('originalEventID must be a non-empty string');
        }
        const liveStreamController = Observer.observe(data, Observer.subtree(), (mutations) => {
            // Ignore individual mutations made by array operations
            if (withArrayMethodDescriptors && Array.isArray(mutations[0].target) && !mutations[0].argumentsList && !['set', 'defineProperty', 'deleteProperty'].includes(mutations[0].operation)) {
                return;
            }
            // Push events. Exclude the reference to target
            let mutationsDone;
            this.postMessage(
                mutations.map((m) => {
                    mutationsDone = this.params.honourDoneMutationFlags && !mutationsDone && m.detail?.done;
                    return { ...m, target: undefined };
                }),
                { eventOptions: { type: `[message:${originalEventID}].mutate` } }
            );
            if (mutationsDone) {
                liveStreamController.abort();
            }
        }, { signal, withArrayMethodDescriptors });
        this.#mutationListeners.add(liveStreamController);
        return liveStreamController;
    }

    applyMutations(data, originalEventID, { signal } = {}) {
        if (isTypeStream(data) || !_isTypeObject(data)) {
            throw new TypeError('data must be a plain object and not a stream');
        }
        if (typeof originalEventID !== 'string') {
            throw new TypeError('originalEventID must be a non-empty string');
        }
        return new Promise((resolve) => {
            const liveStreamController = this.handleMessages(`[message:${originalEventID}].mutate`, (e) => {
                if (!e.data?.length) return;
                let mutationsDone;
                Observer.batch(data, () => {
                    for (const mutation of e.data) {
                        if (mutation.argumentsList) {
                            const target = !mutation.path.length ? data : Observer.get(data, Observer.path(...mutation.path));
                            Observer.proxy(target)[mutation.operation](...mutation.argumentsList);
                        } else if (mutation.key !== 'length' || ['set', 'defineProperty', 'deleteProperty'].includes(mutation.operation)) {
                            const target = mutation.path.length === 1 ? data : Observer.get(data, Observer.path(...mutation.path.slice(0, -1)));
                            if (mutation.type === 'delete') {
                                Observer.deleteProperty(target, mutation.key);
                            } else {
                                Observer.set(target, mutation.key, mutation.value);
                            }
                        }
                        mutationsDone = this.params.honourDoneMutationFlags && !mutationsDone && mutation.detail?.done;
                    }
                });
                if (mutationsDone) {
                    cleanup();
                }
            }, { signal });
            const cleanup = () => {
                liveStreamController();
                resolve();
            };
            this.#mutationListeners.add(cleanup);
        });
    }

    /* ----------------- */

    $destroy() {
        for (const mutationListener of this.#mutationListeners) {
            if (typeof mutationListener === 'function') {
                mutationListener();
            } else if (mutationListener instanceof AbortController) {
                mutationListener.abort();
            }
        }
        this.#mutationListeners.clear();
        return super.$destroy();
    }
}