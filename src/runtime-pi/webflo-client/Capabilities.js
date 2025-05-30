import { Observer } from '@webqit/quantum-js';

export class Capabilities {

    #runtime;
    #params;

    #exposed = {};
    get exposed() { return this.#exposed; }

    #cleanups = [];

    static async initialize(runtime, params) {
        const instance = new this;
        instance.#runtime = runtime;
        instance.#params = params;
        // --------
        // Custom install
        const onbeforeinstallprompt = (e) => {
            if (instance.#params.custom_install && instance.#exposed.custom_install !== 'granted') {
                e.preventDefault();
                Observer.set(instance.#exposed, 'custom_install', e);
            }
        };
        window.addEventListener('beforeinstallprompt', onbeforeinstallprompt);
        instance.#cleanups.push(() => window.removeEventListener('beforeinstallprompt', onbeforeinstallprompt));
        // --------
        // Webhooks
        if (instance.#runtime.env('GENERIC_PUBLIC_WEBHOOK_URL')) {
            // --------
            // app.installed
            const onappinstalled = () => {
                fetch(instance.#runtime.env('GENERIC_PUBLIC_WEBHOOK_URL'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'app.installed', data: true })
                }).catch(() => {});
            };
            window.addEventListener('appinstalled', onappinstalled);
            instance.#cleanups.push(() => window.removeEventListener('appinstalled', onappinstalled));
            // --------
            // push.subscribe/unsubscribe
            if (instance.#params.webpush) {
                try {
                    const pushPermissionStatus = await navigator.permissions.query({ name: 'push', userVisibleOnly: true });
                    const pushPermissionStatusHandler = async () => {
                        const pushManager = (await navigator.serviceWorker.getRegistration()).pushManager;
                        const eventPayload = pushPermissionStatus.state === 'granted'
                            ? { type: 'push.subscribe', data: await pushManager.getSubscription() }
                            : { type: 'push.unsubscribe' };
                        if (eventPayload.type === 'push.subscribe' && !eventPayload.data) {
                            return window.queueMicrotask(pushPermissionStatusHandler);
                        }
                        fetch(instance.#runtime.env('GENERIC_PUBLIC_WEBHOOK_URL'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(eventPayload)
                        }).catch(() => {});
                    }
                    pushPermissionStatus.addEventListener('change', pushPermissionStatusHandler);
                    instance.#cleanups.push(() => pushPermissionStatus.removeEventListener('change', pushPermissionStatusHandler));
                } catch(e) {}
            }
        }
        // --------
        // Exposure
        if (Array.isArray(instance.#params.exposed) && instance.#params.exposed.length) {
            const [permissions, cleanup] = await instance.query(instance.#params.exposed.map((s) => s.trim()), true);
            instance.#exposed = permissions;
            instance.#cleanups.push(cleanup);
        }
        return instance;
    }

    async query(query, live = false) {
        const permissions = {}, cleanups = [];
        for (let q of [].concat(query)) {
            q = this.resolveQuery(q);
            // ------
            // Display mode
            if (q.name === 'display-mode') {
                const handleDisplayMode = () => {
                    if (document.referrer.startsWith('android-app://')) {
                        Observer.set(permissions, 'display_mode', 'twa');
                        return;
                    }
                    for (const dm of ['browser', 'standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']) {
                        const mediaQuery = window.matchMedia(`(display-mode: ${dm})`);
                        if (mediaQuery.matches) {
                            Observer.set(permissions, 'display_mode', dm);
                            if (live) {
                                mediaQuery.addEventListener('change', handleDisplayMode, { once: true });
                                cleanups.push(() => mediaQuery.removeEventListener('change', handleDisplayMode));
                            }
                            return;
                        }
                    }
                };
                handleDisplayMode();
                continue;
            }
            // ------
            // Others
            try {
                const permissionStatus = await navigator.permissions.query(q);
                permissions[permissionStatus.name.replace(/-/g, '_')] = permissionStatus.state;
                if (live) {
                    const onchange = () => {
                        Observer.set(permissions, permissionStatus.name.replace(/-/g, '_'), permissionStatus.state);
                    };
                    permissionStatus.addEventListener('change', onchange);
                    cleanups.push(() => permissionStatus.removeEventListener('change', onchange));
                }
            } catch(e) {
                permissions[q.name.replace(/-/g, '_')] = 'unsupported';
                console.log(e);
            }
        }
        if (live) {
            return [
                permissions,
                () => cleanups.forEach((c) => c())
            ];
        }
        return permissions;
    }

    async request(name, params = {}) {
        params = this.resolveRequest(name, params);
        // ------
        // install
        if (name === 'install') {
            let returnValue;
            if (this.#exposed.custom_install === 'granted') return;
            if (this.#exposed.custom_install) {
                returnValue = await this.#exposed.custom_install.prompt?.();
                const { outcome } = await this.#exposed.custom_install.userChoice;
                if (outcome === 'dismissed') return;
            }
            Observer.set(this.#exposed, 'custom_install', 'granted');
            return returnValue;
        }
        // ------
        // notification
        if (name === 'notification') {
            return await new Promise(async (resolve, reject) => {
                const permissionResult = Notification.requestPermission(resolve);
                if (permissionResult) {
                    permissionResult.then(resolve, reject);
                }
            });
        }
        // ------
        // push
        if (name === 'push') {
            const pushManager = (await navigator.serviceWorker.getRegistration()).pushManager;
            const subscription = (await pushManager.getSubscription()) || await pushManager.subscribe(params);
            return subscription;
        }
    }

    async supports(q) {
        try {
            await navigator.permissions.query(this.resolveQuery(q));
            return true;
        } catch(e) {
            return false;
        }
    }

    resolveQuery(q) {
        if (typeof q === 'string') {
            q = { name: q };
        }
        if (q.name === 'push' && !q.userVisibleOnly) {
            q = { ...q, userVisibleOnly: true };
        }
        if (q.name === 'top-level-storage-access' && !q.requestedOrigin) {
            q = { ...q, requestedOrigin: window.location.origin };
        }
        return q;
    }

    resolveRequest(name, params = {}) {
        if (name === 'push') {
            if (!params.userVisibleOnly) {
                params = { ...params, userVisibleOnly: true };
            }
            if (!params.applicationServerKey && this.#runtime.env('VAPID_PUBLIC_KEY')) {
                params = { ...params, applicationServerKey: urlBase64ToUint8Array(this.#runtime.env('VAPID_PUBLIC_KEY')) };
            }
        }
        return params;
    }

    close() {
        this.#cleanups.forEach((c) => c());
    }
}

// Public base64 to Uint
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}