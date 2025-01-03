export class AbstractWorkport {

    #params;
    get params() { return this.#params; }

    constructor(connection, params = {}) {
        this.#connection = connection;
        this.#params = params;
    }

    #connection;
    connection(callback = null) {
        if (!callback) return this.#connection;
        return this.onStateChange('connected', callback);
    }

    #wasOnceConnected = false;
    #hasActivities = 0;
    get hasActivities() { return !!this.#hasActivities; }

    #hooks = new Set;
    onStateChange(state, callback, { once = true } = {}) {
        if ((state === 'connected' && this.#connection)
        || (state === 'disconnected' && !this.#connection && this.#wasOnceConnected)) {
            callback(this.#connection);
            if (once) {
                return () => {};
            }
        }
        if (state === 'connected') {
            this.#hasActivities ++;
        }
        const hook = { state, callback, once };
        this.#hooks.add(hook);
        return () => this.#hooks.delete(hook);
    }

    stateChange(state, arg) {
        if (state === 'connected') {
            this.#wasOnceConnected = true;
            this.#connection = arg;
        }
        if (state === 'disconnected' && arg === this.#connection) {
            this.#connection = null;
        }
        for (const hook of this.#hooks) {
            if (hook.state !== state) continue;
            hook.callback(arg);
            if (hook.once) {
                this.#hooks.delete(hook);
            }
        }
    }

    postMessage(message, transferOrOptions = []) {
        this.connection((connection) => {
            connection.postMessage(message, transferOrOptions);
        });
    }

    postMessageCallback(message, callback, options = {}) {
        this.connection((connection) => {
            const { signal, once, ...$options } = options;
            const messageChannel = new MessageChannel();
            messageChannel.port1.addEventListener('message', (e) => callback(e.data), {
                signal,
                once
            });
            messageChannel.port1.start();
            connection.postMessage(message, { ...$options, transfer: [ messageChannel.port2 ] });
        });
    }

    addEventListener(type, listener, options = {}) {
        this.connection((connection) => {
            connection.addEventListener(type, listener, options);
        });
    }

    removeEventListener(type, listener, options = {}) {
        this.connection((connection) => {
            connection.removeEventListener(type, listener, options);
        });
    }

    createBroadcastChannel(name) {
        return new BroadcastChannel(name);
    }
}