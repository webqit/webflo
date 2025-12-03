import { Observer, LiveProgramHandle } from '@webqit/use-live';
import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { publishMutations, applyMutations } from '../webflo-messaging/wq-message-port.js';
import { WQBroadcastChannel } from '../webflo-messaging/WQBroadcastChannel.js';
import { WQSockPort } from '../webflo-messaging/WQSockPort.js';
import { response as responseShim } from './index.js';
import { _wq, _await } from '../../util.js';
import { isTypeStream } from './util.js';

export class LiveResponse extends EventTarget {

    [Symbol.toStringTag] = 'LiveResponse';

    static test(data) {
        if (data instanceof LiveResponse
            || data?.[Symbol.toStringTag] === 'LiveResponse') {
            return 'LiveResponse';
        }
        if (data instanceof Response) {
            return 'Response';
        }
        if (isGenerator(data)) {
            return 'Generator';
        }
        if (data instanceof LiveProgramHandle
            || data?.[Symbol.toStringTag] === 'LiveProgramHandle') {
            return 'LiveProgramHandle';
        }
        return 'Default';
    }

    static async from(data, ...args) {
        if (this.test(data) === 'LiveResponse') {
            return data.clone(...args);
        }
        if (this.test(data) === 'Response') {
            return await this.fromResponse(data, ...args);
        }
        if (this.test(data) === 'Generator') {
            return await this.fromGenerator(data, ...args);
        }
        if (this.test(data) === 'LiveProgramHandle') {
            return this.fromLiveProgramHandle(data, ...args);
        }
        return new this(data, ...args);
    }

    static async fromResponse(response, options = {}) {
        if (!(response instanceof Response)) {
            throw new Error('Argument must be a Response instance.');
        }

        const body = await responseShim.prototype.parse.value.call(response);

        // Instance
        const instance = new this(body, {
            status: responseShim.prototype.status.get.call(response),
            statusText: response.statusText,
            headers: response.headers,
            done: false,
            ...options,
        });
        const responseMeta = _wq(response, 'meta');
        _wq(instance).set('meta', responseMeta);

        // Generator binding
        if (this.hasBackground(response) === 2) {
            const backgroundPort = this.getBackground(response);
            if (_isTypeObject(body) && !isTypeStream(body)) {
                applyMutations.call(backgroundPort,
                    body,
                    response.headers.get('X-Live-Response-Message-ID').trim(),
                    { signal: instance.#abortController.signal }
                );
            }
            // Capture subsequent frames?
            backgroundPort.addEventListener('response.replace', (e) => {
                const { body, ...options } = e.data;
                instance.#replaceWith(body, options);
            }, { signal: instance.#abortController.signal });
            backgroundPort.addEventListener('close', () => {
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
    }

    static async fromGenerator(gen, options = {}) {
        if (!isGenerator(gen)) {
            throw new Error('Argument must be a generator or async generator.');
        }

        const firstFrame = await gen.next();
        const firstValue = await firstFrame.value;

        if (firstValue instanceof Response && firstFrame.done && options.done !== false/* && value.responsesOK*/) {
            return firstValue;
        }

        let instance;
        let frame = firstFrame;
        let value = firstValue;
        let $$await;

        const $options = { done: firstFrame.done, ...options };
        if (this.test(value) === 'LiveResponse') {
            instance = new this;
            const responseMeta = _wq(value, 'meta');
            _wq(instance).set('meta', responseMeta);
            $$await = instance.#replaceWith(value, $options);
        } else {
            instance = await this.from/*important*/(value, $options);
        }

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
    }

    static async fromLiveProgramHandle(liveProgramHandle, options = {}) {
        if (!this.test(liveProgramHandle) === 'LiveProgramHandle') {
            throw new Error('Argument must be a UseLive LiveProgramHandle instance.');
        }
        const instance = new this;
        await instance.replaceWith(liveProgramHandle.value, { done: false, ...options });
        if (instance.#generatorType === 'Default') {
            instance.#generator = liveProgramHandle;
            instance.#generatorType = 'LiveProgramHandle';
        }
        Observer.observe(
            liveProgramHandle,
            'value',
            (e) => instance.#replaceWith(e.value),
            { signal: instance.#abortController.signal }
        );
        return instance;
    }

    static hasBackground(respone) {
        let liveLevel = (respone.headers?.get?.('X-Background-Messaging-Port')?.trim() || _wq(respone, 'meta').has('background_port')) && 1 || 0;
        liveLevel += respone.headers?.get?.('X-Live-Response-Message-ID')?.trim() && 1 || 0;
        return liveLevel;
    }

    static getBackground(respone) {
        if (!/Response/.test(this.test(respone) )) return;
        const responseMeta = _wq(respone, 'meta');
        if (!responseMeta.has('background_port')) {
            const value = respone.headers.get('X-Background-Messaging-Port')?.trim();
            if (value) {
                const [proto, portID] = value.split(':');
                let backgroundPort;
                if (proto === 'br') {
                    backgroundPort = new WQBroadcastChannel(portID);
                } else if (proto === 'ws') {
                    backgroundPort = new WQSockPort(portID);
                } else {
                    throw new Error(`Unknown background messaging protocol: ${proto}`);
                }
                responseMeta.set('background_port', backgroundPort);
            }
        }
        return responseMeta.get('background_port');
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

    get background() { return this.constructor.getBackground(this); }

    /* Lifecycle methods */

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

        if (body instanceof Promise) {
            this.#extendLifecycle(body);
            return await new Promise((resolve, reject) => {
                let aborted = false;
                this.#abortController.signal.addEventListener('abort', () => {
                    aborted = true
                    resolve();
                });
                body.then(async (resolveData) => {
                    resolve();
                    if (aborted) return;
                    await this.#replaceWith(resolveData, ...args);
                });
                body.catch((e) => reject(e));
            });
        }

        const options = _isObject(args[0]/* !ORDER 1 */) ? { ...args.shift() } : {};
        const frameClosure = typeof args[0]/* !ORDER 2 */ === 'function' ? args.shift() : null;

        if ('status' in options) {
            options.status = parseInt(options.status);
            if (options.status < 200 || options.status > 599) {
                throw new Error(`The status provided (${options.status}) is outside the range [200, 599].`);
            }
        }
        if ('statusText' in options) {
            options.statusText = String(options.statusText);
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

        const execReplaceWithResponse = async (response, options) => {
            this.#generator = response;
            this.#generatorType = response instanceof Response ? 'Response' : 'LiveResponse';
            const body = response instanceof Response ? await responseShim.prototype.parse.value.call(response) : response.body;
            execReplaceWith({
                body,
                status: responseShim.prototype.status.get.call(response),
                statusText: response.statusText,
                headers: response.headers,
                ...options,
                type: response.type,
                redirected: response.redirected,
                url: response.url,
            });
            if (this.constructor.test(response) === 'LiveResponse') {
                response.addEventListener('replace', () => execReplaceWith(response), { signal: this.#abortController.signal });
                return await response.whileLive(true);
            }
            return Promise.resolve();
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
                url: null
            });
            if (frameClosure) {
                const reactiveProxy = _isTypeObject(body) && !isTypeStream(body)
                    ? Observer.proxy(body, { chainable: true, membrane: body })
                    : body;
                return await frameClosure.call(this, reactiveProxy);
            }
            return Promise.resolve();
        };

        let donePromise;
        if (/Response/.test(body)) {
            if (frameClosure) {
                throw new Error('frameClosure unsupported for inputs of type response.');
            }
            donePromise = execReplaceWithResponse(body, options);
        } else {
            donePromise = execReplaceWithBody(body, options);
        }

        if (options.done === false) {
            this.#extendLifecycle(new Promise(() => { }));
        } else {
            this.#extendLifecycle(donePromise);
        }

        return await new Promise((resolve, reject) => {
            this.#abortController.signal.addEventListener('abort', resolve);
            donePromise.then(() => resolve());
            donePromise.catch((e) => reject(e));
        });
    }

    async replaceWith(body, ...args) {
        if (!this.whileLive()) {
            throw new Error(`Instance already "complete".`);
        }
        this.disconnect(); // Disconnect from existing source if any
        await this.#replaceWith(body, ...args);
    }

    toResponse({ client: clientPort, signal: abortSignal } = {}) {
        const response = responseShim.from.value(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers,
        });

        const responseMeta = _wq(this, 'meta');
        _wq(response).set('meta', responseMeta);

        if (clientPort && this.whileLive()) {
            const liveResponseMessageID = Date.now().toString();
            response.headers.set('X-Live-Response-Message-ID', liveResponseMessageID);

            // Publish mutations
            if (_isTypeObject(this.body) && !isTypeStream(this.body)) {
                publishMutations.call(clientPort, this.body, liveResponseMessageID, { signal: abortSignal/* stop observing mutations on body when we abort */ });
            }

            // Publish replacements?
            const replaceHandler = () => {
                const headers = Object.fromEntries([...this.headers.entries()]);
                if (headers?.['set-cookie']) {
                    delete headers['set-cookie'];
                    console.warn('Warning: The "set-cookie" header is not supported for security reasons and has been removed from the response.');
                }
                clientPort.postMessage({
                    body: this.body,
                    status: this.status,
                    statusText: this.statusText,
                    headers,
                    done: !this.whileLive(),
                }, { wqEventOptions: { type: 'response.replace', live: true/*gracefully ignored if not an object*/ }, observerOptions: { signal: abortSignal/* stop observing mutations on body when we abort */ } });
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

    toLiveProgramHandle({ signal: abortSignal } = {}) {
        const state = new LiveProgramHandleX;
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

export const isGenerator = (obj) => {
    return typeof obj?.next === 'function' &&
        typeof obj?.throw === 'function' &&
        typeof obj?.return === 'function';
};

class LiveProgramHandleX extends LiveProgramHandle {
    constructor() { }
    abort() { }
}
