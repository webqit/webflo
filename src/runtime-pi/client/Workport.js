import { AbstractWorkport } from '../AbstractWorkport.js';

export class Workport extends AbstractWorkport {

    #file;
    get file() { return this.#file; }

    #ready;
    get ready() { return this.#ready; }

    #lifecycle = new Map;
    get lifecycle() { return this.#lifecycle; }

    constructor(file, params = {}) {
        super(undefined, params);
        this.#file = file;
        this.#ready = navigator.serviceWorker ? navigator.serviceWorker.ready : new Promise(() => {});
        this.registration();
    }

    #registration;
    async registration() {
        if (this.#registration) return this.#registration;
        this.#registration = await navigator.serviceWorker.register(this.#file, { scope: this.params.scope || '/' });
        // Helper that updates instance's state
        const stateChange = (target) => {
            // target.state can be any of: "parsed", "installing", "installed", "activating", "activated", "redundant"
            const equivState = target.state === 'redundant' ? 'disconnected' : 
                (target.state === 'activated' ? 'connected' : target.state)
            if (target.state !== equivState) {
                this.stateChange(target.state, target);
            }
            this.stateChange(equivState, target);
        }

        // We're always installing at first for a new service worker.
        // An existing service would immediately be active
        const worker = this.#registration.active || this.#registration.waiting || this.#registration.installing;
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

    async requestNotificationPermission() {
        return new Promise(async (resolve, reject) => {
            const permissionResult = Notification.requestPermission(resolve);
            if (permissionResult) {
                permissionResult.then(resolve, reject);
            }
        });
    }

    async showNotification(title, params = {}) {
        await this.#ready;
        return (await this.registration()).showNotification(title, params);
    }
    
    async pushSubscription(autoPrompt = true) {
        await this.#ready;
        let subscription = await (await this.registration()).pushManager.getSubscription();
        let VAPID_PUBLIC_KEY, PUSH_REGISTRATION_PUBLIC_URL;
        if (!subscription && autoPrompt && (VAPID_PUBLIC_KEY = this.params.env[this.params.vapid_key_env])) {
            subscription = await (await this.registration()).pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            if (PUSH_REGISTRATION_PUBLIC_URL = this.params.env[this.params.push_registration_url_env]) {
                await fetch(PUSH_REGISTRATION_PUBLIC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(subscription),
                });
            }
        }
        return subscription;
    }

    async pushUnsubscribe() {
        await this.#ready;
        const subscription = await (await this.registration()).pushManager.getSubscription();
        subscription?.unsubscribe();
        let PUSH_REGISTRATION_PUBLIC_URL;
        if (subscription && (PUSH_REGISTRATION_PUBLIC_URL = this.params.env[this.params.push_registration_url_env])) {
            await fetch(PUSH_REGISTRATION_PUBLIC_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(subscription),
            });
        }
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
