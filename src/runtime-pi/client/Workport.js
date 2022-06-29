

/**
 * @imports
 */
import { _isFunction, _isObject } from '@webqit/util/js/index.js';
import { Observer } from './Runtime.js';

export default class Workport {

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
        const postSendCallback = (message, callback, onAvailability = 1) => {
            if (this.active) {
                if (_isFunction(message)) message = message();
                callback(this.active, message);
            } else if (onAvailability) {
                // Availability Handling
                const availabilityHandler = entry => {
                    if (_isFunction(message)) message = message();
                    callback(entry.value, message);
                    if (onAvailability !== 2) {
                        Observer.unobserve(this, 'active', availabilityHandler);
                    }
                };
                Observer.observe(this, 'active', availabilityHandler);
            }
        };
        this.messaging = {
            post: (message, onAvailability = 1) => {
                postSendCallback(message, (active, message) => {
                    active.postMessage(message);
                }, onAvailability);
                return this.post;
            },
            listen: callback => {
                navigator.serviceWorker.addEventListener('message', callback);
                return this.post;
            },
            request: (message, onAvailability = 1) => {
                return new Promise(res => {
                    postSendCallback(message, (active, message) => {
                        let messageChannel = new MessageChannel();
                        active.postMessage(message, [ messageChannel.port2 ]);
                        messageChannel.port1.onmessage = e => res(e.data);
                    }, onAvailability);
                });
            },
            channel(channelId) {
                if (!this.channels.has(channelId)) { this.channels.set(channelId, new BroadcastChannel(channel)); }
                let channel = this.channels.get(channelId);
                return {
                    broadcast: message => channel.postMessage(message),
                    listen: callback => channel.addEventListener('message', callback),
                };
            },
            channels: new Map,
        };

        // --------
        // Notifications
        // --------
        this.notifications = {
            fire: (title, params = {}) => {
                return new Promise((res, rej) => {
                    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
                        return rej(typeof Notification !== 'undefined' && Notification && Notification.permission);
                    }
                    notification.addEventListener('error', rej);
                    let notification = new Notification(title, params);
                    notification.addEventListener('click', res);
                    notification.addEventListener('close', res);
                });
            },
        };

        // --------
        // Push notifications
        // --------
        this.push = {
            getSubscription: async () => {
                return (await this.registration).pushManager.getSubscription();
            },
            subscribe: async (publicKey, params = {}) => {
                var subscription = await this.push.getSubscription();
                return subscription ? subscription : (await this.registration).pushManager.subscribe(
                    _isObject(publicKey) ? publicKey : {
                        applicationServerKey: urlBase64ToUint8Array(publicKey),
                        ...params,
                    }
                );
            },
            unsubscribe: async () => {
                var subscription = await this.push.getSubscription();
                return !subscription ? null : subscription.unsubscribe();
            },
        };
    }

}

// Public base64 to Uint
function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
