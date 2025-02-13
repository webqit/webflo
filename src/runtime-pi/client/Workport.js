import { WebfloMessagingAPI } from '../WebfloMessagingAPI.js';

export class Workport extends WebfloMessagingAPI {

    #registration;
    get registration() { return this.#registration; }

    #params;
    get params() { return this.#params; }

    #ready;
    get ready() { return this.#ready; }

    static async create(parentNode, file, params = {}) {
        const registration = (await navigator.serviceWorker.getRegistration())
            || (await navigator.serviceWorker.register(file, { scope: '/', ...params }));
        return new this(parentNode, registration, params);
    }

    constructor(parentNode, registration, params = {}) {
        super(parentNode, params);
        this.#registration = registration;
        this.#params = params;
        this.#ready = navigator.serviceWorker ? navigator.serviceWorker.ready : new Promise(() => {});
        // Helper that updates instance's state
        const stateChange = (target) => {
            // target.state can be any of: "parsed", "installing", "installed", "activating", "activated", "redundant"
            if (target.state === 'redundant') {
                //this.remove(target);
            } else if (target.state === 'activated') {
                //this.add(target);
            }
        }
        // We're always installing at first for a new service worker.
        // An existing service would immediately be active
        const worker = this.#registration.active || this.#registration.waiting || this.#registration.installing;
        if (worker)  {
            stateChange(worker);
            worker.addEventListener('statechange', (e) => stateChange(e.target));
            // "updatefound" event - a new worker that will control
            // this page is installing somewhere
            this.#registration.addEventListener('updatefound', () => {
                // If updatefound is fired, it means that there's
                // a new service worker being installed.
                stateChange(this.#registration.installing);
                this.#registration.installing.addEventListener('statechange', (e) => stateChange(e.target));
            });
        }





        this.#worker.start?.();
        const messageHandler = async (event) => {
            if (this.isPrimary && event.data === 'connection') {
                this.$emit('connected');
            }
            if (event.data === 'close') {
                // Endpoint 2 is closed
                this.#port.removeEventListener('message', messageHandler);
                this.dispatchEvent(new Event('close'));
                this.$destroy();
            }
            if (!_isObject(event.data) || !['messageType', 'message'].every((k) => k in event.data)) {
                return;
            }
            this.dispatchEvent(new ChannelMessageEvent(
                this,
                event.data.messageType,
                event.data.message,
                event.ports
            ));
        };
        this.#worker.addEventListener('message', messageHandler);
    }

    postMessage(message, transferOrOptions = []) {
        this.on('connected', () => {
            if (Array.isArray(transferOrOptions)) {
                transferOrOptions = { transfer: transferOrOptions };
            }
            const { messageType = 'message', ...options } = transferOrOptions;
            return this.#port.postMessage({
                messageType,
                message
            }, options);
        });
        super.postMessage(message, transferOrOptions);
    }
    
    async getPushSubscription(autoPrompt = true) {
        if (!this.#registration) {
            throw new Error(`Service worker not registered`);
        }
        await this.#swReady;
        const pushManager = (await this.#registration).pushManager;
        let subscription = await pushManager.getSubscription();
        if (!subscription && autoPrompt && this.#swParams.WEBFLO_VAPID_PUBLIC_KEY) {
            subscription = await pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(this.#swParams.WEBFLO_VAPID_PUBLIC_KEY),
            });
            if (this.#swParams.WEBFLO_PUBLIC_WEBHOOK_URL) {
                await fetch(this.#swParams.WEBFLO_PUBLIC_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'push.subscribe',
                        data: subscription
                    })
                });
            }
        }
        return {
            ...subscription,
            unsubscribe: async () => {
                subscription.unsubscribe();
                if (this.#swParams.WEBFLO_PUBLIC_WEBHOOK_URL) {
                    await fetch(this.#swParams.WEBFLO_PUBLIC_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify({
                            type: 'push.unsubscribe',
                            data: subscription
                        })
                    });
                }
            }
        };
    }

    async requestNotificationPermission() {
        return await new Promise(async (resolve, reject) => {
            const permissionResult = Notification.requestPermission(resolve);
            if (permissionResult) {
                permissionResult.then(resolve, reject);
            }
        });
    }

    async showNotification(title, params = {}) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            return registration.showNotification(title, params);
        }
        return new Notification(title, params);
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
