

/**
 * @imports
 */
import { _isFunction, _isObject } from '@webqit/util/js/index.js';
import { Observer } from './Runtime.js';

export default class Workport {

    constructor(file, params = {}, env = {}) {
        this.ready = navigator.serviceWorker ? navigator.serviceWorker.ready : new Promise(() => {});

        // --------
        // Registration and lifecycle
        // --------
        this.registration = new Promise((resolve, reject) => {
            if (!navigator.serviceWorker) return;
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
            if (params.onWindowLoad) {
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
                const availabilityHandler = Observer.observe(this, 'active', entry => {
                    if (_isFunction(message)) message = message();
                    callback(entry.value, message);
                    if (onAvailability !== 2) { availabilityHandler.abort(); }
                });
            }
        };
        this.messaging = {
            post: (message, onAvailability = 1) => {
                postSendCallback(message, (active, message) => {
                    active.postMessage(message);
                }, onAvailability);
                return this;
            },
            listen: callback => {
                if (navigator.serviceWorker) {
                    navigator.serviceWorker.addEventListener('message', evt => {
                        const response = callback(evt);
                        let responsePort = evt.ports[0];
                        if (responsePort) {
                            if (response instanceof Promise) {
                                response.then(data => {
                                    responsePort.postMessage(data);
                                });
                            } else {
                                responsePort.postMessage(response);
                            }
                        }
                    });
                }
                return this;
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
            requestPermission: () => {
                return new Promise(async (resolve, reject) => {
                    const permissionResult = Notification.requestPermission(resolve);
                    if (permissionResult) { permissionResult.then(resolve, reject); }
                });
            },
            fire: async (title, params = {}) => {
                await this.ready;
                return (await this.registration).showNotification(title, params);
            },
        };

        // --------
        // Push notifications
        // --------
        this.push = {
            getSubscription: async (autoPrompt = true) => {
                await this.ready;
                let subscription = await (await this.registration).pushManager.getSubscription();
                let VAPID_PUBLIC_KEY, PUSH_REGISTRATION_PUBLIC_URL;
                if (!subscription && autoPrompt && (VAPID_PUBLIC_KEY = env[params.vapid_key_env])) {
                    subscription = await (await this.registration).pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                    });
                    if (PUSH_REGISTRATION_PUBLIC_URL = env[params.push_registration_url_env]) {
                        await fetch(PUSH_REGISTRATION_PUBLIC_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', },
                            body: JSON.stringify(subscription),
                        });
                    }
                }
                return subscription;
            },
            unsubscribe: async () => {
                await this.ready;
                const subscription = await (await this.registration).pushManager.getSubscription();
                subscription?.unsubscribe();
                let PUSH_REGISTRATION_PUBLIC_URL;
                if (subscription && (PUSH_REGISTRATION_PUBLIC_URL = env[params.push_registration_url_env])) {
                    await fetch(PUSH_REGISTRATION_PUBLIC_URL, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify(subscription),
                    });
                }
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
