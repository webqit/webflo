export class AbstractWorkport {

    #params;
    get params() { return this.#params; }

    constructor(params = {}) {
        this.#params = params;
    }

    #workers = new Set;
    get length() { return this.#workers.size; }

    [ Symbol.iterator ]() { return this.#workers[ Symbol.iterator ](); }

    #onConnectionHooks = 0;
    get hasActivities() { return !!this.#onConnectionHooks; }

    #allTimeHasWorkers;
    add(worker) {
        this.#workers.add(worker);
        this.#emit('add', worker);
        if (!this.#allTimeHasWorkers) {
            this.#emit('active', worker);
        }
        this.#allTimeHasWorkers = true;
    }

    remove(worker) {
        this.#workers.delete(worker);
        this.#emit('remove', worker);
        if (!this.#isReplaceAction && this.#workers.size === 0) {
            this.#emit('empty');
        }
    }

    #isReplaceAction;
    replace(worker) {
        this.#isReplaceAction = true;
        for (const worker of this.#workers) {
            this.remove(worker);
        }
        this.#isReplaceAction = false;
        this.add(worker);
    }

    get(index, callback = null) {
        const _leadMax = this.#workers.size - 1;
        if (index > _leadMax && callback) {
            return this.on('add', () => this.get(index, callback), { once: true });
        }
        const worker = [...this.#workers][index];
        if (callback) {
            callback(worker);
        } else return worker;
    }

    #hooks = new Set;
    on(state, callback, { once = false } = {}) {
        if (['add', 'active'].includes(state)) {
            this.#onConnectionHooks ++;
            if (state === 'active' && this.#workers.size) {
                callback();
                if (once) {
                    return;
                }
            }
        }
        const hook = { on: state, callback, once };
        this.#hooks.add(hook);
        return () => this.#hooks.delete(hook);
    }

    #emit(eventName, arg) {
        for (const hook of this.#hooks) {
            if (hook.on !== eventName) continue;
            hook.callback(arg);
            if (hook.once) {
                this.#hooks.delete(hook);
            }
        }
    }
    
    postMessage(message, transferOrOptions = []) {
        if (!this.#workers.size) {
            return this.on('add', (w) => w.postMessage(message, transferOrOptions), { once: true });
        }
        for (const w of this.#workers) {
            w.postMessage(message, transferOrOptions);
        }
    }

    postRequest(message, callback, options = {}) {
        if (!this.#workers.size) {
            return this.on('add', () => this.postRequest(message, callback, options), { once: true });
        }
        const { signal, once, ...$options } = options;
        const messageChannel = new MessageChannel();
        messageChannel.port1.addEventListener('message', (e) => callback(e), {
            signal,
            once
        });
        messageChannel.port1.start();
        for (const w of this.#workers) {
            w.postMessage(message, { ...$options, transfer: [ messageChannel.port2 ] });
        }
    }

    handleMessages(type, listener, options = {}) {
        for (const w of this.#workers) {
            w.addEventListener(type, listener, options);
        }
        const cancel1 = this.on('add', (w) => w.addEventListener(type, listener, options));
        const cancel2 = this.on('remove', (w) => w.removeEventListener(type, listener, options));
        return () => {
            for (const w of this.#workers) {
                w.removeEventListener(type, listener, options);
            }
            cancel1();
            cancel2();
        };
    }

    handleRequests(type, listener, options = {}) {
        return this.handleMessages(type, async (e) => {
            const response = await listener(e);
            for (const p of e.ports) {
                p.postMessage(response);
            }
        }, options);
    }

    createBroadcastChannel(name) {
        return new BroadcastChannel(name);
    }
}