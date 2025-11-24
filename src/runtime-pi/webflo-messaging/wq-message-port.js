import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { WQMessagePort, WQMessagePortInstanceTag } from './WQMessagePort.js';
import { isTypeStream } from '../webflo-fetch/util.js';
import { WQMessageEvent } from './WQMessageEvent.js';
import { Observer } from '@webqit/use-live';
import { _wq } from '../../util.js';

/**
 * transferOrOptions has the following structure:
 * {
 *   transfer: Array<Transferable>,
 *   wqEventOptions: {
 *     eventID: String,         // Optional, this is the ID of the event
 *     type: String,            // The type of the event, e.g. 'message', 'request', 'mutations'
 *     live: Boolean,           // If true, the data is to be transmitted as a live object
 *     bubbles: Boolean,        // If true, the message bubbles up through the event system
 *     forwarded: Boolean,      // Added at this.dispatchEvent() when forwarding messages
 *   },
 *   wqProcessingOptions: {     // Eventually added while processing
 *     except,                  // Addable by anyone but added at this.dispatchEvent() when forwarding messages
 *     observing,               // Added at the outermost postMessage() call when actually publishingMutations
 *   },
 *   wqObserverOptions: {       // Stripped at the outermost postMessage() call
 *     signal: AbortSignal,     // Optional signal to abort the live object
 *     withArrayMethodDescriptors: Boolean, // If true, array method descriptors are included in mutations
 *   },
 *   ...restOptions             // Any other options that should be passed to the postMessage method
 * }
 */
export function preProcessPostMessage(data, transferOrOptions) {
    if (Array.isArray(transferOrOptions)) {
        transferOrOptions = { transfer: transferOrOptions };
    } else if (!transferOrOptions || typeof transferOrOptions !== 'object') {
        throw new TypeError('transferOrOptions must be an array or an object');
    }
    let {
        wqEventOptions = {},              // Remove and re-add after normalization
        wqProcessingOptions = {},         // Remove and re-add after normalization
        wqObserverOptions = {},           // Remove for use here
        ...options
    } = transferOrOptions;
    if (!wqEventOptions.type) {
        // Set wqEventOptions.type
        wqEventOptions = { ...wqEventOptions, type: 'message' };
    }
    if (!wqEventOptions.eventID) {
        // Set wqEventOptions.eventID
        wqEventOptions = { ...wqEventOptions, eventID: `${wqEventOptions.type}-${(0 | Math.random() * 9e6).toString(36)}` };
    }
    if (!wqProcessingOptions.observing && !wqEventOptions.forwarded && _isTypeObject(data) && wqEventOptions.live && !wqEventOptions.type?.endsWith('.mutate')) {
        wqProcessingOptions = { ...wqProcessingOptions, observing: true }; // Set wqProcessingOptions.observing
        publishMutations.call(this, data, wqEventOptions.eventID, wqObserverOptions);
    }
    // Re-combine
    return { ...options, wqEventOptions, wqProcessingOptions };
}

export function publishMutations(data, originalEventID, { signal, withArrayMethodDescriptors = true, honourDoneMutationFlags = false } = {}) {
    if (isTypeStream(data) || !_isTypeObject(data)) {
        throw new TypeError('data must be a plain object and not a stream');
    }
    if (typeof originalEventID !== 'string') {
        throw new TypeError('originalEventID must be a non-empty string');
    }
    const meta = _wq(this, 'meta');
    meta.set('mutationListeners', meta.get('mutationListeners') || new Set);
    const mutationListeners = meta.get('mutationListeners');
    const liveStreamController = Observer.observe(data, Observer.subtree(), (mutations) => {
        // Ignore individual mutations made by array operations
        if (withArrayMethodDescriptors && Array.isArray(mutations[0].target) && !mutations[0].argumentsList && !['set', 'defineProperty', 'deleteProperty'].includes(mutations[0].operation)) {
            return;
        }
        // Push events. Exclude the reference to target
        let mutationsDone;
        this.postMessage(
            mutations.map((m) => {
                mutationsDone = honourDoneMutationFlags && !mutationsDone && m.detail?.done;
                return { ...m, target: undefined };
            }),
            { wqEventOptions: { type: `${originalEventID}.mutate` } }
        );
        if (mutationsDone) {
            liveStreamController.abort();
        }
    }, { signal, withArrayMethodDescriptors });
    mutationListeners.add(liveStreamController);
    return liveStreamController;
}

export function applyMutations(data, originalEventID, { signal, honourDoneMutationFlags = false } = {}) {
    if (isTypeStream(data) || !_isTypeObject(data)) {
        throw new TypeError('data must be a plain object and not a stream');
    }
    if (typeof originalEventID !== 'string') {
        throw new TypeError('originalEventID must be a non-empty string');
    }
    const meta = _wq(this, 'meta');
    meta.set('mutationListeners', meta.get('mutationListeners') || new Set);
    const mutationListeners = meta.get('mutationListeners');
    return new Promise((resolve) => {
        const messageHandler = (e) => {
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
                    mutationsDone = honourDoneMutationFlags && !mutationsDone && mutation.detail?.done;
                }
            });
            if (mutationsDone) {
                cleanup();
            }
        };
        this.addEventListener(`${originalEventID}.mutate`, messageHandler, { signal });
        const cleanup = () => {
            this.removeEventListener(`${originalEventID}.mutate`, messageHandler);
            resolve();
        };
        mutationListeners.add(cleanup);
    });
}

export function forwardPort(eventTypes, eventTarget, { resolveData = null, bidirectional = false, namespace1 = null, namespace2 = null } = {}) {
    if (!(this instanceof WQMessagePort) || !(eventTarget instanceof WQMessagePort)) {
        throw new Error('Both ports must be instance of WQMessagePort.');
    }
    if (!eventTypes) {
        throw new Error('Event types must be specified.');
    }
    const meta = _wq(this, 'meta');
    meta.set('downstreamRegistry', meta.get('downstreamRegistry') || new Set);
    const downstreamRegistry = meta.get('downstreamRegistry');
    const registration = { eventTarget, eventTypes, options: { resolveData, namespace1, namespace2 } };
    downstreamRegistry.add(registration);
    let cleanup2;
    if (bidirectional) {
        cleanup2 = forwardPort.call(
            eventTarget,
            typeof eventTypes === 'function' ? eventTypes : [].concat(eventTypes).filter((s) => s !== 'close'),
            this,
            { resolveData, bidirectional: false, namespace1: namespace2, namespace2: namespace1 }
        );
    }
    return () => {
        downstreamRegistry.delete(registration);
        cleanup2?.();
    };
}

export function forwardEvent(event) {
    if (event.propagationStopped) return;
    const meta = _wq(this, 'meta');
    if (meta.get('parentNode') instanceof EventTarget && (
        event.bubbles || meta.get('parentNode').findPort?.((port) => port === this) && event instanceof WQMessageEvent)
    ) {
        meta.get('parentNode').dispatchEvent(event);
    }
    if (!meta.has('downstreamRegistry')) return;
    const downstreamRegistry = meta.get('downstreamRegistry');
    if (event instanceof WQMessageEvent || event.type === 'close' || event.type.endsWith(':close')) {
        const { type, eventID, data, live, bubbles, ports } = event;
        const called = new WeakSet;
        for (const { eventTarget, eventTypes, options } of downstreamRegistry) {
            if (called.has(eventTarget)) continue;
            let matches, $type = type;
            if (options.namespace1) {
                [, $type] = (new RegExp(`^${options.namespace1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([^:]+)$`)).exec(type) || [];
                if (!$type) continue;
            }
            if (typeof eventTypes === 'function') {
                matches = eventTypes($type, this, eventTarget, options);
            } else {
                matches = [].concat(eventTypes).find((t) => {
                    return t === $type || ($type !== 'close' && t === '*'); // Star shouldn't imply close
                });
            }
            if (!matches) continue;
            called.add(eventTarget);
            if ($type === 'close') {
                eventTarget.close?.();
            } else {
                eventTarget.postMessage(options.resolveData ? options.resolveData(data, this, eventTarget, options) : data, {
                    transfers: ports,
                    wqEventOptions: { type: options.namespace2 ? `${options.namespace2}:${$type}` : $type, eventID, bubbles, live, forwarded: true },
                    wqProcessingOptions: { except: this } // IMPORTANT, in BroadcastChannel scenarios
                });
            }
        }
    }
}

export function portHooksCleanup() {
    const meta = _wq(this, 'meta');
    // 1. Destry listenersRegistry
    for (const args of meta.get('listenersRegistry') || []) {
        this.removeEventListener(...args);
    }
    meta.get('listenersRegistry')?.clear();
    // 2. Destroy downstreamRegistry
    meta.get('downstreamRegistry')?.clear();
    // 3. Destroy mutationListeners
    for (const mutationListener of meta.get('mutationListeners') || []) {
        if (typeof mutationListener === 'function') {
            mutationListener();
        } else if (mutationListener instanceof AbortController) {
            mutationListener.abort();
        }
    }
    meta.get('mutationListeners')?.clear();
}

export function toWQPort(port) {
    if (WQMessagePortInstanceTag in port) {
        return port;
    }
    const portMeta = _wq(port, 'meta');
    const messageHandler = (e) => {
        if (!_isObject(e.data) || !e.data['.wq']) return;
        // Handle lifecycle events from the other end
        if (!portMeta.get('open')) {
            // On first message, whether just an "open" ping or not...
            // Fire an "open" event on self
            portMeta.set('open', true);
            port.dispatchEvent(new Event('open'));
            portMeta.get('onlineCallback')?.();
        }
        if (!portMeta.get('close') && e.data.ping === 'close') {
            // On receiving a "close" ping
            // Fire a "close" event on self
            portClose.call(port);
        }
        // Stop here if just a ping event
        if (['open', 'close'].includes(e.data.ping)) {
            e.stopImmediatePropagation();
            return;
        }
        // Do event rewrites and the Webflo live object magic
        if (e.type === 'message' && 'data' in e.data && ['wqEventOptions', 'wqProcessingOptions'].every((k) => _isObject(e.data[k]))) {
            e.stopImmediatePropagation();
            const event = new WQMessageEvent(port, {
                data: e.data.data,
                wqEventOptions: e.data.wqEventOptions,
                wqProcessingOptions: e.data.wqProcessingOptions,
                ports: e.ports,
            });
            port.dispatchEvent(event);
            forwardEvent.call(port, event);
            return;
        }
    };
    port.addEventListener('message', messageHandler);
    portMeta.set('messageHandler', messageHandler);
    // Only after the above native methods usages...
    Object.defineProperty(port, 'wqLifecycle', {
        value: {
            open: new Promise((resolve) => {
                if (portMeta.get('open')) return resolve();
                portMeta.set('onlineCallback', resolve);
            }),
            close: new Promise((resolve) => {
                if (portMeta.get('close')) return resolve();
                portMeta.set('offlineCallback', resolve);
            }),
            messaging: new Promise((resolve) => {
                if (portMeta.get('messaging')) return resolve();
                portMeta.set('messagingCallback', resolve);
            }),
        }
    });
    Object.defineProperties(port, prototypeExtensions);
    // Set the tag
    port[WQMessagePortInstanceTag] = true;
    return port;
}

export function internalAddEventListener(args) {
    const meta = _wq(this, 'meta');
    meta.set('listenersRegistry', meta.get('listenersRegistry') || new Set);
    meta.get('listenersRegistry').add(args);
}

export function postRequest(data, callback, options = {}) {
    const { eventOptions2 = {}, transfer = [], ...$options } = options;
    const { signal, once } = eventOptions2;
    const messageChannel = new MessageChannel;
    messageChannel.port1.start();
    messageChannel.port1.addEventListener('message', (e) => callback(e), { signal, once });
    return this.postMessage(data, { ...$options, transfer: [messageChannel.port2].concat(transfer) });
}

export function handleRequests(type, listener, options = {}) {
    const $listener = async (e) => {
        const response = await listener(e);
        for (const port of e.ports) {
            port.postMessage(response);
        }
    };
    this.addEventListener(type, $listener, options);
    return () => {
        this.removeEventListener(type, $listener, options);
    };
}

export function portIsMessaging() {
    const meta = _wq(this, 'meta');
    if (!meta.get('messaging')) {
        meta.set('messaging', true);
        meta.get('messagingCallback')?.();
    }
}

function autoPortOpen() {
    const meta = _wq(this, 'meta');
    if (!meta.get('open')) {
        meta.set('open', true);
        this.postMessage({
            ['.wq']: true,
            ping: 'open',
        });
    }
}

function portClose() {
    // Unregister custom event rewrites
    const meta = _wq(this, 'meta');
    this.removeEventListener('message', meta.get('messageHandler'));
    meta.set('close', true);
    meta.get('offlineCallback')?.();
    portHooksCleanup.call(this);
    this.dispatchEvent(new Event('close'));
    // Unset the tag
    this[WQMessagePortInstanceTag] = false;
}

const prototypeOriginals = {
    addEventListener: MessagePort.prototype.addEventListener,
    postMessage: MessagePort.prototype.postMessage,
    close: MessagePort.prototype.close,
    onmessage: Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage'),
};

const prototypeExtensions = {
    wqForwardPort: {
        value: function (eventTypes, eventTarget, { resolveData = null, bidirectional = false, namespace1 = null, namespace2 = null } = {}) {
            return forwardPort.call(this, eventTypes, eventTarget, { resolveData, bidirectional, namespace1, namespace2 });
        }
    },
    // --------
    addEventListener: {
        value: function (...args) {
            // On first interaction,
            // ping the other end with "open"
            autoPortOpen.call(this);
            internalAddEventListener.call(this, args);
            return prototypeOriginals.addEventListener.call(this, ...args);
        },
    },
    onmessage: {
        get: function () {
            return prototypeOriginals.onmessage.get.call(this);
        },
        set: function (value) {
            this.start();
            autoPortOpen.call(this);
            return prototypeOriginals.onmessage.set.call(this, value);
        },
    },
    postMessage: {
        value: function (data, transferOrOptions = {}) {
            portIsMessaging.call(this);
            const { wqEventOptions, wqProcessingOptions: _, ...portOptions } = preProcessPostMessage.call(this, data, transferOrOptions);
            return prototypeOriginals.postMessage.call(this, {
                data,
                wqEventOptions,
                wqProcessingOptions: {},
                ['.wq']: true,
            }, portOptions);
        }
    },
    postRequest: { value: postRequest },
    handleRequests: { value: handleRequests },
    close: {
        value: function () {
            // On close, tear down and fire "close" event on self
            // and ping the other end with "close"
            portClose.call(this);
            this.postMessage({
                ['.wq']: true,
                ping: 'close',
            });
            return prototypeOriginals.close.call(this);
        }
    },
};