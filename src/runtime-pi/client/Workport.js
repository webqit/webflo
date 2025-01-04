import { AbstractWorkport } from '../AbstractWorkport.js';

export class Workport extends AbstractWorkport {

    #swFile;
    #swParams = {};

    #swReady;
    get swReady() { return this.#swReady; }
    #swRegistration;

    async registerServiceWorker(file, params = {}) {
        if (this.#swRegistration) {
            throw new Error('Service worker already registered');
        }
        this.#swFile = file;
        this.#swParams = params;
        this.#swReady = navigator.serviceWorker ? navigator.serviceWorker.ready : new Promise(() => {});
        this.#swRegistration = await navigator.serviceWorker.register(this.#swFile, { scope: this.#swParams.scope || '/' });
        // Helper that updates instance's state
        const stateChange = (target) => {
            // target.state can be any of: "parsed", "installing", "installed", "activating", "activated", "redundant"
            if (target.state === 'redundant') {
                this.remove(target);
            } else if (target.state === 'activated') {
                this.add(target);
            }
        }
        // We're always installing at first for a new service worker.
        // An existing service would immediately be active
        const worker = this.#swRegistration.active || this.#swRegistration.waiting || this.#swRegistration.installing;
        if (worker)  {
            stateChange(worker);
            worker.addEventListener('statechange', (e) => stateChange(e.target));
            // "updatefound" event - a new worker that will control
            // this page is installing somewhere
            this.#swRegistration.addEventListener('updatefound', () => {
                // If updatefound is fired, it means that there's
                // a new service worker being installed.
                stateChange(this.#swRegistration.installing);
                this.#swRegistration.installing.addEventListener('statechange', (e) => stateChange(e.target));
            });
        }
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
        await this.#swReady;
        if (this.#swRegistration) {
            return (await this.#swRegistration).showNotification(title, params);
        }
        return new Notification(title, params);
    }
    
    async pushSubscription(autoPrompt = true) {
        if (!this.#swRegistration) {
            throw new Error(`Service worker not registered`);
        }
        await this.#swReady;
        const pushManager = (await this.#swRegistration).pushManager;
        let subscription = await pushManager.getSubscription();
        if (!subscription && autoPrompt && this.#swParams.VAPID_PUBLIC_KEY) {
            subscription = await pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(this.#swParams.VAPID_PUBLIC_KEY),
            });
            if (this.#swParams.PUSH_REGISTRATION_PUBLIC_URL) {
                await fetch(this.#swParams.PUSH_REGISTRATION_PUBLIC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(subscription)
                });
            }
        }
        return subscription;
    }

    async pushUnsubscribe() {
        if (!this.#swRegistration) {
            throw new Error(`Service worker not registered`);
        }
        await this.#swReady;
        const pushManager = (await this.#swRegistration).pushManager;
        const subscription = await pushManager.getSubscription();
        if (subscription) {
            subscription.unsubscribe();
            if (subscription && this.#swParams.PUSH_REGISTRATION_PUBLIC_URL) {
                await fetch(this.#swParams.PUSH_REGISTRATION_PUBLIC_URL, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(subscription)
                });
            }
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
