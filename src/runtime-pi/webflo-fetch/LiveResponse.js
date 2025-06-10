import { State, Observer } from '@webqit/quantum-js';
import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { backgroundMessagingPort } from './response.js';
import { isTypeStream } from './util.js';
import { _await, _wq } from '../../util.js';

const isGenerator = (obj) => {
    return typeof obj?.next === 'function' &&
        typeof obj?.throw === 'function' &&
        typeof obj?.return === 'function';
};

class StateX extends State {
    constructor() { }
    dispose() { }
}

export class LiveResponse extends EventTarget {

    /* STATIC methods for Input sources */

    static test(data) {
        if (data instanceof LiveResponse) {
            return 'LiveResponse';
        }
        if (data instanceof Response) {
            return 'Response';
        }
        if (isGenerator(data)) {
            return 'Generator';
        }
        if (data instanceof State) {
            return 'Quantum';
        }
        return 'Default';
    }

    static from(data, ...args) {
        if (data instanceof LiveResponse) {
            return data.clone(...args);
        }
        if (data instanceof Response) {
            return this.fromResponse(data, ...args);
        }
        if (isGenerator(data)) {
            return this.fromGenerator(data, ...args);
        }
        if (data instanceof State) {
            return this.fromQuantum(data, ...args);
        }
        return new this(data, ...args);
    }

    static fromResponse(response, options = {}) {
        if (!(response instanceof Response)) {
            throw new Error('Argument must be a Response instance.');
        }
        return response.parse().then((body) => {
            // Instance
            const instance = new this(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                done: false,
                ...options,
            });
            const responseMeta = _wq(response, 'meta');
            _wq(instance).set('meta', responseMeta);
            // Generator binding
            if (response.isLive() === 2) {
                if (_isTypeObject(body) && !isTypeStream(body)) {
                    response.backgroundMessagingPort.applyMutations(
                        body,
                        response.headers.get('X-Live-Response-Message-ID').trim(),
                        { signal: instance.#abortController.signal }
                    );
                }
                // Capture subsequent frames?
                response.backgroundMessagingPort.addEventListener('response.replace', (e) => {
                    const { body, ...options } = e.data;
                    instance.#replaceWith(body, options);
                }, { signal: instance.#abortController.signal });
                response.backgroundMessagingPort.addEventListener('close', () => {
                    instance.#extendLifecycle(Promise.resolve());
                }, { once: true, signal: instance.#abortController.signal });
            }
            // Data props
            instance.#type = response.type;
            instance.#redirected = response.redirected;
            instance.#url = response.url;
            // Lifecycle props
            instance.#generator = response;
            instance.#generatorType = 'Response';
            return instance;
        });
    }

    static fromGenerator(gen, options = {}) {
        if (!isGenerator(gen)) {
            throw new Error('Argument must be a generator or async generator.');
        }
        const $firstFrame = gen.next();
        const instance = _await($firstFrame, (frame) => {
            return _await(frame.value, (value) => {
                const $options = { done: frame.done, ...options };
                let instance, $$await;
                if (value instanceof Response && frame.done && options.done !== false && options.responsesOK) {
                    return value;
                }
                if (value instanceof LiveResponse) {
                    instance = new this;
                    const responseMeta = _wq(value, 'meta');
                    _wq(instance).set('meta', responseMeta);
                    $$await = instance.#replaceWith(value, $options);
                } else {
                    instance = this.from/*important*/(value, $options);
                }
                return _await(instance, (instance) => {
                    (async function () {
                        await $$await;
                        instance.#generator = gen;
                        instance.#generatorType = 'Generator';
                        while (!frame.done && !options.done && !instance.#abortController.signal.aborted) {
                            frame = await gen.next();
                            value = await frame.value;
                            if (!instance.#abortController.signal.aborted) {
                                await instance.#replaceWith(value, { done: frame.done });
                            }
                        }
                    })();
                    return instance;
                });
            });
        });
        return instance;
    }

    static fromQuantum(qState, options = {}) {
        if (!(qState instanceof State)) {
            throw new Error('Argument must be a Quantum State instance.');
        }
        const instance = new this(qState.value, { done: false, ...options });
        instance.#generator = qState;
        instance.#generatorType = 'Quantum';
        Observer.observe(
            qState,
            'value',
            (e) => instance.#replaceWith(e.value),
            { signal: instance.#abortController.signal }
        );
        return instance;
    }

    #generator = null;
    #generatorType = 'Default';
    get generatorType() { return this.#generatorType; }

    #abortController = new AbortController;

    disconnect() {
        // Disconnection from existing generator
        this.#abortController.abort();
        this.#generator = null;
        this.#generatorType = 'Default';
        // and a new signal system
        this.#abortController = new AbortController;
    }

    /* INSTANCE */

    constructor(body, ...args) {
        super();
        this.#replaceWith(body, ...args);
    }

    /* Level 1 props */

    body = null; // Managed at #replaceWith()

    #headers = new Headers;
    get headers() { return this.#headers; }

    #status = 200;
    get status() { return this.#status; }

    #statusText = '';
    get statusText() { return this.#statusText; }

    get ok() { return this.#status >= 200 && this.#status < 299; }

    get bodyUsed() { return false; }

    /* Level 2 props */

    #type = 'basic';
    get type() { return this.#type; }

    #redirected = false;
    get redirected() { return this.#redirected; }

    #url = null;
    get url() { return this.#url; }

    /* Level 3 props */

    get backgroundMessagingPort() {
        return backgroundMessagingPort.call(this);
    }

    /* Lifecycle methods */

    isLive() {
        let liveLevel = (this.headers.get('X-Background-Messaging-Port')?.trim() || _wq(this, 'meta').has('backgroundMessagingPort')) && 1 || 0;
        liveLevel += this.headers.get('X-Live-Response-Message-ID')?.trim() && 1 || 0;
        return liveLevel;
    }

    whileLive(returningThePromise = false) {
        if (returningThePromise) {
            return this.#lifeCycleResolutionPromise;
        }
        return this.#currentFramePromise !== null;
    }

    #currentFramePromise;
    #lifeCycleResolve;
    #lifeCycleReject;
    #lifeCycleResolutionPromise = new Promise((resolve, reject) => {
        this.#lifeCycleResolve = resolve;
        this.#lifeCycleReject = reject;
    });

    #extendLifecycle(promise) {
        if (this.#currentFramePromise === null) {
            throw new Error('Event lifecycle already complete.');
        }
        this.#currentFramePromise = promise;
        promise.then((value) => {
            if (this.#currentFramePromise === promise) {
                this.#currentFramePromise = null;
                this.#lifeCycleResolve(value);
            }
        }).catch((e) => {
            if (this.#currentFramePromise === promise) {
                this.#currentFramePromise = null;
                this.#lifeCycleReject(e);
            }
        });
    }

    async #replaceWith(body, ...args) {
        const options = _isObject(args[0]/* !ORDER 1 */) ? { ...args.shift() } : {};
        const frameClosure = typeof args[0]/* !ORDER 2 */ === 'function' ? args.shift() : null;
        if ('status' in options) {
            options.status = parseInt(options.status);
            if (options.status < 200 || options.status > 599) {
                throw new Error(`The status provided (${options.status}) is outside the range [200, 599].`);
            }
        }
        if ('statusText' in options) {
            options.statusText = String(options.status.statusText);
        }
        if (options.headers && !(options.headers instanceof Headers)) {
            options.headers = new Headers(options.headers);
        }
        const execReplaceWith = (responseLike) => {
            const $body = responseLike.body;
            this.#status = responseLike.status;
            this.#statusText = responseLike.statusText;
            for (const [name] of [/*IMPORTANT*/...this.#headers.entries()]) { // for some reason, some entries not produced when not spread
                this.#headers.delete(name);
            }
            for (const [name, value] of responseLike.headers.entries()) {
                this.#headers.append(name, value);
            }
            this.#type = responseLike.type;
            this.#redirected = responseLike.redirected;
            this.#url = responseLike.url;
            // Must come after all property assignments above because it fires events
            Observer.defineProperty(this, 'body', { get: () => $body, enumerable: true, configurable: true });
            this.dispatchEvent(new Event('replace'));
        };
        const execReplaceWithResponse = async (response, options, resolve) => {
            this.#generator = response;
            this.#generatorType = response instanceof Response ? 'Response' : 'LiveResponse';
            execReplaceWith({
                body: response instanceof Response ? await response.parse() : response.body,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                ...options,
                type: response.type,
                redirected: response.redirected,
                url: response.url,
            });
            if (response instanceof LiveResponse) {
                response.addEventListener('replace', () => execReplaceWith(response), { signal: this.#abortController.signal });
                this.#abortController.signal.addEventListener('abort', resolve);
                return await response.whileLive(true);
            }
        };
        const execReplaceWithBody = async (body, options) => {
            execReplaceWith({
                body,
                status: 200,
                statusText: '',
                headers: new Headers,
                ...options,
                type: 'basic',
                redirected: false,
                url: null,
            });
            if (frameClosure) {
                const reactiveProxy = _isTypeObject(body) && !isTypeStream(body) ? Observer.proxy(body, { chainable: true, membrane: body }) : body;
                return await frameClosure.call(this, reactiveProxy);
            }
        };
        const donePromise = new Promise((resolve) => {
            if (body instanceof Response || body instanceof LiveResponse) {
                if (frameClosure) {
                    throw new Error('frameClosure unsupported for inputs of type response.');
                }
                resolve(execReplaceWithResponse(body, options, resolve));
            } else {
                resolve(execReplaceWithBody(body, options));
            }
        });
        if (options.done === false) {
            this.#extendLifecycle(new Promise(() => { }));
        } else {
            this.#extendLifecycle(donePromise);
        }
        return await donePromise;
    }

    async replaceWith(body, ...args) {
        if (!this.whileLive()) {
            throw new Error(`Instance already "complete".`);
        }
        this.disconnect(); // Disconnect from existing source if any
        await this.#replaceWith(body, ...args);
    }

    toResponse({ clientMessagePort, signal: abortSignal } = {}) {
        const response = Response.from(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers,
        });
        const responseMeta = _wq(this, 'meta');
        _wq(response).set('meta', responseMeta);
        if (clientMessagePort && this.whileLive()) {
            const liveResponseMessageID = Date.now().toString();
            response.headers.set('X-Live-Response-Message-ID', liveResponseMessageID);
            // Publish mutations
            if (_isTypeObject(this.body) && !isTypeStream(this.body)) {
                clientMessagePort.publishMutations(this.body, liveResponseMessageID, { signal: abortSignal/* stop observing mutations on body when we abort */ });
            }
            // Publish replacements?
            const replaceHandler = () => {
                const headers = Object.fromEntries([...this.headers.entries()]);
                if (headers?.['set-cookie']) {
                    delete headers['set-cookie'];
                    console.warn('Warning: The "set-cookie" header is not supported for security reasons and has been removed from the response.');
                }
                clientMessagePort.postMessage({
                    body: this.body,
                    status: this.status,
                    statusText: this.statusText,
                    headers,
                    done: !this.whileLive(),
                }, { eventOptions: { type: 'response.replace', live: true/*gracefully ignored if not an object*/ }, liveOptions: { signal: abortSignal/* stop observing mutations on body when we abort */ } });
            };
            this.addEventListener('replace', replaceHandler, { signal: abortSignal/* stop listening when we abort */ });
        }
        return response;
    }

    async * toGenerator({ signal: abortSignal } = {}) {
        do {
            yield $this.body;
        } while (await new Promise((resolve) => {
            this.addEventListener('replace', () => resolve(true), { once: true, signal: abortSignal });
            this.whileLive(true).then(() => resolve(false));
        }));
    }

    toQuantum({ signal: abortSignal } = {}) {
        const state = new StateX;
        const replaceHandler = () => Observer.defineProperty(state, 'value', { value: this.body, enumerable: true, configurable: true });
        this.addEventListener('replace', replaceHandler, { signal: abortSignal });
        replaceHandler();
        return state;
    }

    clone(init = {}) {
        const clone = new this.constructor();
        const responseMeta = _wq(this, 'meta');
        _wq(clone).set('meta', responseMeta);
        clone.replaceWith(this, init);
        return clone;
    }
}

globalThis.LiveResponse = LiveResponse;
