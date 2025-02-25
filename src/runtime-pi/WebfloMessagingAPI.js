import { WebfloEventTarget } from './WebfloEventTarget.js';

export class WebfloMessagingAPI extends WebfloEventTarget {

    #isConnected = false;
    isConnected() { return this.#isConnected; }

    #isSending = false;
    isMessaging() { return this.#isSending || !!this.length; }

    #hooks = new Set;
    get $hooks() { return this.#hooks; }

    on(eventName, callback, { once = false } = {}) {
        if (eventName === 'connected' && this.#isConnected) {
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
        if (eventName === 'connected') {
            this.#isConnected = true;
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

    postMessage(data, transferOrOptions = []) {
        this.#isSending = true;
    }

    postRequest(message, callback, options = {}) {
        const { signal, once, ...$options } = options;
        const messageChannel = new MessageChannel;
        messageChannel.port1.addEventListener('message', (e) => callback(e), {
            signal,
            once
        });
        messageChannel.port1.start();
        return this.postMessage(message, { ...$options, transfer: [ messageChannel.port2 ].concat($options.transfer || []) });
    }

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
}