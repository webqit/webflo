

/**
 * @imports
 */
import { Observer } from '@webqit/pseudo-browser/index2.js';
import { _isFunction } from '@webqit/util/js/index.js';
import { _copy } from '@webqit/util/obj/index.js';

export default class WorkerClient {

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

                    // We're always installing at first
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
            receive: (callback, onAvailability = 1) => {
                if (!this.active) {
                    navigator.serviceWorker.startMessages();
                };
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

    // Sync Local Storage
    sharedStore(store, persistent = false, onAvailability = 1) {
        const storeData = () => Observer.keys(store).reduce((_store, key) => (_store[key] = store[key], _store), {});
        this.post.send(() => ({ _type: 'WHOLE_STORAGE_SYNC', _persistent: persistent, store: storeData() }), onAvailability);
        window.addEventListener('beforeunload', e => {
            this.post.send({ _type: 'WHOLE_STORAGE_SYNC', _persistent: persistent });
        });
        // --------
        Observer.observe(store, changes => {
            changes.forEach(change => {
                if (change.type === 'set') {
                    if (!(change.detail || {}).noSync) {
                        this.post.send({ _type: 'STORAGE_SYNC', _persistent: persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]) });
                    }
                } else if (change.type === 'deletion') {
                    if (!(change.detail || {}).noSync) {
                        this.post.send({ _type: 'STORAGE_SYNC', _persistent: persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]) });
                    }
                }
            });
        });
        // --------
        this.post.receive(e => {
            if (e.data && e.data._type === 'STORAGE_SYNC' && e.data._persistent === persistent) {
                if (e.data.type === 'set') {
                    Observer.set(store, e.data.name, e.data.value, { detail: { noSync: true } });
                } else if (e.data.type === 'deletion') {
                    Observer.deleteProperty(store, e.data.name, { detail: { noSync: true } });
                }
            }
        }, onAvailability);
    }

}