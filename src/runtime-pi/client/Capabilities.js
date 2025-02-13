const { Observer } = webqit;

export class Capabilities {

    #params;
    constructor(params = {}) {
        this.#params = params;
    }

    async permissions(queries) {
        const permissions = {};
        for (let query of queries) {
            try {
                const permissionStatus = await navigator.permissions.query(this.resolveQuery(query));
                permissions[permissionStatus.name] = permissionStatus.state;
                permissionStatus.onchange = () => {
                    Observer.set(permissions, permissionStatus.name, permissionStatus.state);
                }
            } catch(e) {
                permissions[query.name] = 'unsupported';
            }
        }
        return permissions;
    }

    async request(name, params = {}) {
        if (name === 'notification') {
            return await new Promise(async (resolve, reject) => {
                const permissionResult = Notification.requestPermission(resolve);
                if (permissionResult) {
                    permissionResult.then(resolve, reject);
                }
            });
        }
    }

    async supports(query) {
        try {
            await navigator.permissions.query(this.resolveQuery(query));
            return true;
        } catch(e) {
            return false;
        }
    }

    resolveQuery(query) {
        if (typeof query === 'string') {
            query = { name: query };
        }
        if (query.name === 'top-level-storage-access' && !query.requestedOrigin) {
            query = { ...query, requestedOrigin: window.location.origin };
        }
        return query;
    }

    resolveRequest(name, params = {}) {
        if (name === 'push' && !params.applicationServerKey && this.#params.WEBFLO_VAPID_PUBLIC_KEY) {
            params = { applicationServerKey: urlBase64ToUint8Array(this.#params.WEBFLO_VAPID_PUBLIC_KEY) };
        }
        return params;
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