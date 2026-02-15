import { Observer, ListenerRegistry, Descriptor } from '@webqit/observer';

export class DeviceCapabilities {

    #params;

    #exposed = {};
    get exposed() { return this.#exposed; }

    static async recognizesPermission(q) {
        try {
            await navigator.permissions.query(this.resolveQuery(q));
            return true;
        } catch (e) {
            return false;
        }
    }

    static resolveQuery(q) {
        if (typeof q === 'string') {
            q = { name: q };
        } else q = { ...q };
        if (q.name === 'push' && !q.userVisibleOnly) {
            q = { ...q, userVisibleOnly: true };
        }
        if (q.name === 'top-level-storage-access' && !q.requestedOrigin) {
            q = { ...q, requestedOrigin: window.location.origin };
        }
        return q;
    }

    constructor(params = {}) {
        this.#params = params;

        if (Array.isArray(this.#params.exposed) && this.#params.exposed.length) {
            for (const capName of this.#params.exposed) {
                const queryName = capName.trim().replace(/_/g, '-');
                const capInstance = this.query(queryName);
                this.#exposed[capName] = capInstance;
            }
        }
    }

    close() {
        this.#capInstances.forEach((c) => c.dispose());
    }

    #capInstances = new Map;

    query(query) {
        const _q = this.constructor.resolveQuery(query);

        if (this.#capInstances.has(_q.name)) {
            return this.#capInstances.get(_q.name);
        }

        let capInstance;
        switch (_q.name) {
            case 'pwa-install':
                capInstance = new PWAInstallCapability;
            case 'geolocation':
                capInstance = new GeolocationCapability;
            case 'notification':
                //capInstance = new NotificationCapability;
            case 'push':
                //capInstance = new PushCapability;
            case 'storage-access':
                //capInstance = new StorageAccessCapability;
        }

        this.#capInstances.set(_q.name, capInstance);

        return capInstance;
    }
}

/**
 * DeviceCapability
 */

class DeviceCapability {

    #listenersRegistry;
    _cleanups = [];

    constructor() {
        this.#listenersRegistry = ListenerRegistry.getInstance(this, true);
    }

    _fire(props, exec) {
        const oldValues = {};
        for (const prop of props) {
            oldValues[prop] = this[prop];
        }

        if (exec) exec();

        const descriptors = props.map((prop) => {
            return new Descriptor(this, {
                type: 'set',
                key: prop,
                value: this[prop],
                oldValue: oldValues[prop],
                isUpdate: true,
                related: props.slice(),
                operation: 'set',
                detail: null,
            });
        });

        this.#listenersRegistry.emit(descriptors);
    }

    dispose() {
        this._cleanups.forEach((c) => c());
    }
}

/**
 * PWAInstallCapability
 */

class PWAInstallCapability extends DeviceCapability {

    #status = 'unknown';
    #displayMode = null;

    get status() { return this.#status; }
    get displayMode() { return this.#displayMode; }

    #pwaInstallEvent;

    constructor() {
        super();

        // --------------- beforeinstallprompt event

        const onbeforeinstallprompt = (e) => {
            this.#pwaInstallEvent = e;
            this.#pwaInstallEvent.preventDefault();
            this._fire(['status'], () => {
                this.#status = 'prompt-available';
            });
        };

        window.addEventListener('beforeinstallprompt', onbeforeinstallprompt);
        this._cleanups.push(() => window.removeEventListener('beforeinstallprompt', onbeforeinstallprompt));

        // --------------- appinstalled event

        const onappinstalled = async () => {
            this._fire(['status'], () => {
                this.#status = 'installed';
            });
        };

        window.addEventListener('appinstalled', onappinstalled);
        this._cleanups.push(() => window.removeEventListener('appinstalled', onappinstalled));

        // --------------- displayMode

        const _setDisplayMode = (dm) => {
            this._fire(['displayMode'], () => {
                this.#displayMode = dm;
            });
        };

        const handleDisplayMode = () => {
            if (document.referrer.startsWith('android-app://')) {
                _setDisplayMode('twa');
                return;
            }

            for (const dm of ['browser', 'standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']) {
                const mediaQuery = window.matchMedia(`(display-mode: ${dm})`);

                if (mediaQuery.matches) {
                    _setDisplayMode(dm);

                    mediaQuery.addEventListener('change', handleDisplayMode, { once: true });
                    this._cleanups.push(() => mediaQuery.removeEventListener('change', handleDisplayMode));

                    return;
                }
            }
        };

        handleDisplayMode();
    }

    async prompt() {
        if (!this.#pwaInstallEvent) return;

        await this.#pwaInstallEvent.prompt?.();
        const { outcome } = await this.#pwaInstallEvent.userChoice;

        this._fire(['status'], () => {
            this.#status = outcome;
        });

        this.#pwaInstallEvent = null;
    }
}

/**
 * GeolocationCapability
 */

class GeolocationCapability extends DeviceCapability {

    #status = !navigator.geolocation ? 'unsupported' : 'unknown';
    get status() { return this.#status; }

    constructor() {
        super();
        if (!navigator.geolocation) return;

        navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
            const handleChange = () => {
                this._fire(['status'], () => {
                    this.#status = permissionStatus.state;
                });
                if (permissionStatus.state === 'granted') {
                    this.#initEnqueued();
                }
            };

            handleChange();
            permissionStatus.addEventListener('change', handleChange);
            this._cleanups.push(() => permissionStatus.removeEventListener('change', handleChange));
        });
    }

    #queryQueue = new Set;

    #initEnqueued() {
        this.#queryQueue.forEach((cb) => cb());
        this.#queryQueue.clear();
    }

    async read({ live = false, ...options } = {}) {
        const _options = {
            enableHighAccuracy: true,
            ...options
        };

        const process = () => {
            return new Promise((res) => {
                const locationData = {};
                let resolved = false;

                const successCallback = (pos) => {
                    let coords = pos.coords.toJSON();
                    
                    if (!options.detailed) {
                        coords = {
                            lng: coords.longitude,
                            lat: coords.latitude
                        };
                    }

                    if (!Object.keys(coords).every((n) => coords[n] === locationData[n])) {
                        console.log('_________________', coords);
                        Observer.set(locationData, coords);
                    }

                    if (!resolved) {
                        res(locationData);
                        resolved = true;
                    }
                };

                const errrorCallback = (e) => {
                    console.error(e);
                };

                if (live) {
                    const watchID = navigator.geolocation.watchPosition(
                        successCallback,
                        errrorCallback,
                        _options
                    );

                    this._cleanups.push(() => navigator.geolocation.clearWatch(watchID));
                    if (_options.signal) {
                        _options.signal.addEventListener('abort', () => navigator.geolocation.clearWatch(watchID));
                    }
                } else {
                    navigator.geolocation.getCurrentPosition(
                        successCallback,
                        errrorCallback,
                        _options
                    );
                }
            });
        };

        if (this.status !== 'granted') {
            if (live) {
                return new Promise((res) => {
                    const handle = async () => {
                        const liveData = await process();
                        res(liveData);
                    };

                    this.#queryQueue.add(handle);
                });
            }

            return null;
        }

        return await process();
    }

    prompt() {
        if (this.status === 'granted') return;

        navigator.geolocation.getCurrentPosition(
            () => { },
            () => { },
        );
    }

    dispose() {
        this.#queryQueue.clear();
        super.dispose();
    }
}











/*



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





async #initWebpush() {
    if (!this.#runtime?.env('GENERIC_PUBLIC_WEBHOOK_URL')) return;

    try {
        const pushPermissionStatus = await navigator.permissions.query({ name: 'push', userVisibleOnly: true });
        const pushPermissionStatusHandler = async () => {
            const reg = await navigator.serviceWorker.ready;
            const pushManager = reg.pushManager;

            const eventPayload = pushPermissionStatus.state === 'granted'
                ? { type: 'push.subscribe', data: await pushManager.getSubscription() }
                : { type: 'push.unsubscribe' };

            if (eventPayload.type === 'push.subscribe' && !eventPayload.data) {
                return window.queueMicrotask(pushPermissionStatusHandler);
            }

            await fetch(this.#runtime.env('GENERIC_PUBLIC_WEBHOOK_URL'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload),
            }).catch(() => { });
        }

        pushPermissionStatus.addEventListener('change', pushPermissionStatusHandler);
        this.#cleanups.push(() => pushPermissionStatus.removeEventListener('change', pushPermissionStatusHandler));
    } catch (e) { }
}



// notification
        if (name === 'notification') {
            return await new Promise(async (resolve, reject) => {
                const permissionResult = Notification.requestPermission(resolve);
                if (permissionResult) {
                    permissionResult.then(resolve, reject);
                }
            });
        }

        // webpush
        if (name === 'push') {
            const reg = await navigator.serviceWorker.ready;
            const pushManager = reg.pushManager;
            const subscription = (await pushManager.getSubscription()) || await pushManager.subscribe(params);
            return subscription;
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
*/