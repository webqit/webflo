

/**
 * @imports
 */
import { _isFunction } from '@webqit/util/js/index.js';
import { Observer } from './Runtime.js';

export default class WorkerComm {

    constructor(file, params = {}) {
        this.ready = navigator.serviceWorker.ready;
        // --------
        // Registration and lifecycle
        // --------
        this.registration = new Promise((resolve, reject) => {
            const register = () => {
                navigator.serviceWorker.register(file, { scope: params.scope || '/' }).then(async registration => {

                    // Helper that updates instance's state
                    const state = target => {
                        // instance2.state can be any of: "installing", "installed", "activating", "activated", "redundant"
                        const equivState = target.state === 'installed' ? 'waiting' : 
                            (target.state === 'activating' || target.state === 'activated' ? 'active' : target.state)
                        Observer.set(this, equivState, target);
                    }

                    // We're always installing at first for a new service worker.
                    // An existing service would immediately be active
                    const worker = registration.active || registration.waiting || registration.installing;
                    state(worker);
                    worker.addEventListener('statechange', e => state(e.target));
                    
                    // "updatefound" event - a new worker that will control
                    // this page is installing somewhere
                    registration.addEventListener('updatefound', () => {
                        // If updatefound is fired, it means that there's
                        // a new service worker being installed.
                        state(registration.installing);
                        registration.installing.addEventListener('statechange', e => state(e.target));
                    });
                    
                    resolve(registration);
                }).catch(e => reject(e));
            };
            if (params.onWondowLoad) {
                window.addEventListener('load', register);
            } else {
                register();
            }
            if (params.startMessages) {
                navigator.serviceWorker.startMessages();
            }
        });
        // --------
        // Post messaging
        // --------
        this.post = {
            send: (message, onAvailability = 1) => {
                if (this.active) {
                    if (_isFunction(message)) message = message();
                    this.active.postMessage(message);
                } else if (onAvailability) {
                    // Availability Handling
                    const availabilityHandler = entry => {
                        if (_isFunction(message)) message = message();
                        entry.value.postMessage(message);
                        if (onAvailability !== 2) {
                            Observer.unobserve(this, 'active', availabilityHandler);
                        }
                    };
                    Observer.observe(this, 'active', availabilityHandler);
                }
                return this.post;
            },
            receive: callback => {
                navigator.serviceWorker.addEventListener('message', callback);
                return this.post;
            },
        }
        // --------
        // Push notifications
        // --------
        this.push = {
            getSubscription: async () => {
                return (await this.registration).pushManager.getSubscription();
            },
            subscribe: async (publicKey, params = {}) => {
                var subscription = await this.push.getSubscription();
                return subscription ? subscription : (await this.registration).pushManager.subscribe({
                    applicationServerKey: urlBase64ToUint8Array(publicKey),
                    ...params,
                });
            },
            unsubscribe: async () => {
                var subscription = await this.push.getSubscription();
                return !subscription ? null : subscription.unsubscribe();
            },
        }
    }

}