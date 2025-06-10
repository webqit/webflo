import { _isObject } from '@webqit/util/js/index.js';
import { WebfloMessagingAPI } from '../../webflo-messaging/WebfloMessagingAPI.js';
import { WebfloMessageEvent } from '../../webflo-messaging/WebfloMessageEvent.js';

export class ClientSideWorkport extends WebfloMessagingAPI {

    #registration;
    get registration() { return this.#registration; }

    #ready;
    get ready() { return this.#ready; }

    #active;
    get active() { return this.#active; }

    static async initialize(parentNode, file, params = {}) {
        const registration = (await navigator.serviceWorker.getRegistration())
            || (await navigator.serviceWorker.register(file, { scope: '/', ...params }));
        return new this(parentNode, registration, params);
    }

    #messageHandler;
    constructor(parentNode, registration, params = {}) {
        super(parentNode, params);
        this.#registration = registration;
        this.#ready = navigator.serviceWorker ? navigator.serviceWorker.ready : new Promise(() => {});
        // Helper that updates instance's state
        const stateChange = (target) => {
            // target.state can be any of: "parsed", "installing", "installed", "activating", "activated", "redundant"
            if (target.state === 'redundant') {
            } else if (target.state === 'activated') {
                const existing = this.#active;
                this.#active = target;
                if (!existing) {
                    this.dispatchEvent(new Event('open'));
                    this.$emit('open');
                }
            }
        }
        // We're always installing at first for a new service worker.
        // An existing service would immediately be active
        const initial = this.#registration.active || this.#registration.waiting || this.#registration.installing;
        if (initial)  {
            stateChange(initial);
            initial.addEventListener('statechange', (e) => stateChange(e.target));
            // "updatefound" event - a new worker that will control
            // this page is installing somewhere
            this.#registration.addEventListener('updatefound', () => {
                // If updatefound is fired, it means that there's
                // a new service worker being installed.
                stateChange(this.#registration.installing);
                this.#registration.installing.addEventListener('statechange', (e) => stateChange(e.target));
            });
        }
        this.#messageHandler = async (event) => {
            this.dispatchEvent(new WorkerMessageEvent(this, {
                type: event.type,
                data: event.data,
                ports: event.ports,
            }));
        };
        navigator.serviceWorker.addEventListener('message', this.#messageHandler);
    }

    postMessage(data, transferOrOptions = []) {
        this.on('open', () => {
            return this.#active.postMessage(data, transferOrOptions);
        }, { once: true });
        super.postMessage(data, transferOrOptions);
    }

    close() {
        navigator.serviceWorker.removeEventListener('message', this.#messageHandler);
    }
}

export class WorkerMessageEvent extends WebfloMessageEvent {}
