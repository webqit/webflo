import { State, Observer } from '@webqit/quantum-js';
import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { backgroundMessagingPort } from './response.js';
import { isTypeStream, meta } from './util.js';

function _await(value, callback) {
    if (value instanceof Promise) {
        return value.then(callback);
    }
    return callback(value);
}

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

    /* STATIC */

    static create(data, ...args) {
        if (data instanceof this) {
            return data;
        }
        if (data instanceof Response) {
            return this.fromResponse(data);
        }
        if (isGenerator(data)) {
            return this.fromGenerator(data);
        }
        if (data instanceof State) {
            return this.fromQuantum(data);
        }
        return new this(data, ...args);
    }

    static fromResponse(response) {
        if (!(response instanceof Response)) {
            throw new Error('Argument must be a Response instance.');
        }
        return response.parse().then((body) => {
            // Frame binding
            let frameClosure, frameTag;
            if (response.backgroundMessagingPort/* Typically when on the client side */
                && _isTypeObject(body) && !isTypeStream(body)
                && (frameTag = response.headers.get('X-Live-Response-Frame-Tag')?.trim())) {
                frameClosure = async function () {
                    await response.backgroundMessagingPort.applyMutations(
                        body,
                        frameTag,
                        { signal: this.#abortController.signal }
                    );
                };
            }
            // Instance
            const instance = new this(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            }, frameClosure);
            Object.assign(instance[meta], response[meta]);
            // Generator binding
            let generatorDone = true;
            if (response.backgroundMessagingPort/* Typically when on the client side */) {
                // Capture subsequent frames?
                if (response.headers.get('X-Live-Response-Generator-Done')?.trim() !== 'true') {
                    generatorDone = false;
                    response.backgroundMessagingPort.addEventListener('response', (e) => {
                        const { body, ...options } = e.data;
                        instance.replaceWith(body, options);
                    }, { signal: instance.#abortController.signal });
                    response.backgroundMessagingPort.addEventListener('close', () => {
                        instance.#frameDone = true;
                        instance.dispatchEvent(new Event('framedone'));
                        instance.#generatorDone = true;
                        instance.dispatchEvent(new Event('generatordone'));
                    }, { signal: instance.#abortController.signal });
                }
            }
            // Data props
            instance.#type = response.type;
            instance.#redirected = response.redirected;
            instance.#url = response.url;
            // Lifecycle props
            instance.#frameDone = !frameClosure;
            instance.#generatorDone = generatorDone;
            instance.#generatorType = 'Response';
            return instance;
        });
    }

    static fromGenerator(gen) {
        if (!isGenerator(gen)) {
            throw new Error('Argument must be a generator or async generator.');
        }
        const $firstFrame = gen.next();
        const instance = _await($firstFrame, (frame) => {
            return _await(frame.value, (value) => {
                const instance = this.create/*important*/(value, { done: frame.done });
                return _await(instance, (instance) => {
                    instance.#generatorType = 'Generator';
                    (async function () {
                        while (!frame.done && !instance.#abortController.signal.aborted) {
                            frame = await gen.next();
                            value = await frame.value;
                            await instance.replaceWith(value, { done: frame.done });
                        }
                    })();
                    return instance;
                });
            });
        });
        return instance;
    }

    static fromQuantum(state) {
        if (!(state instanceof State)) {
            throw new Error('Argument must be a Quantum State instance.');
        }
        const instance = new this(state.value);
        instance.#generatorType = 'Quantum';
        Observer.observe(
            state,
            'value',
            (e) => instance.replaceWith(e.value),
            { signal: instance.#abortController.signal }
        );
        return instance;
    }

    /* INSTANCE */

    constructor(body, ...args) {
        super();
        this.#replaceWith(body, ...args);
    }

    #meta = {};
    get [meta]() { return this.#meta; }

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

    /* Lifecycle props */

    #generatorType = 'Default';
    get generatorType() { return this.#generatorType; }

    #frameClosurePromise = null;
    get frameClosurePromise() { return this.#frameClosurePromise; }

    #frameDone = false;
    get frameDone() { return this.#frameDone; }

    #generatorDone = false;
    get generatorDone() { return this.#generatorDone; }

    #abortController = new AbortController;

    close() {
        this.#abortController.abort();
    }

    clone(init = {}) {
        const clonedResponse = new this.constructor(this.body, {
            status: this.#status,
            statusText: this.#statusText,
            headers: this.#headers,
            ...init
        });
        clonedResponse.#type = this.#type;
        clonedResponse.#redirected = this.#redirected;
        clonedResponse.#url = this.#url;
        clonedResponse.#generatorType = this.#generatorType;
        clonedResponse.#frameClosurePromise = this.#frameClosurePromise;
        clonedResponse.#frameDone = this.#frameDone;
        clonedResponse.#generatorDone = this.#generatorDone;
        Object.assign(clonedResponse[meta], this[meta]);
        return clonedResponse;
    }

    #replaceWith(body, ...args) {
        const options = _isObject(args[0]/* !ORDER 1 */) ? args.shift() : {};
        const frameClosure = typeof args[0]/* !ORDER 2 */ === 'function' ? args.shift() : null;
        if (/\d/.test(options.status)) {
            this.#status = parseInt(options.status);
        }
        if (![undefined, null].includes(options.statusText)) {
            this.#statusText = options.statusText + '';
        }
        if (options.headers) {
            this.#headers = new Headers(options.headers);
        }
        // frameClosure
        this.#frameClosurePromise = null;
        if (frameClosure) {
            this.#frameClosurePromise = Promise.resolve(frameClosure.call(this, _isTypeObject(body) && !isTypeStream(body) ? Observer.proxy(body, { chainable: true, membrane: body }) : body)).then(() => {
                this.#frameDone = true;
                this.dispatchEvent(new Event('framedone'));
            });
        }
        // False for a new frame
        this.#frameDone = (!_isTypeObject(body) || isTypeStream(body)) && !frameClosure/*This is still honoured*/;
        // Even if done before, we resume
        this.#generatorDone = !!options.done;
        // Must come all property assignments above
        Observer.defineProperty(this, 'body', { get: () => body, enumerable: true, configurable: true });
        // Must come as last
        if (this.#frameDone) {
            this.dispatchEvent(new Event('framedone'));
        }
        if (this.#generatorDone) {
            this.dispatchEvent(new Event('generatordone'));
        }
    }

    replaceWith(body, ...args) {
        if (body instanceof Response || body instanceof LiveResponse) {
            const response = body;
            const options = _isObject(args[0]/* !ORDER 1 */) ? args.shift() : {};
            if (typeof args[0]/* !ORDER 2 */ === 'function') {
                throw new Error('frameClosure unsupported for inputs of type response.');
            }
            return _await(response instanceof Response ? response.parse() : response.body, (body) => {
                const frameClosure = response instanceof LiveResponse && !response.frameDone && (async () => {
                    await new Promise((resolve) => response.addEventListener('framedone', resolve, { once: true }));
                }) || null;
                return this.replaceWith(body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    ...options
                }, frameClosure);
            });
        }
        this.#replaceWith(body, ...args);
        this.dispatchEvent(new Event('replace'));
    }

    toResponse({ clientMessagingPort } = {}) {
        const response = Response.create(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers,
        });
        Object.assign(response[meta], this[meta]);
        if (clientMessagingPort/* Typically when on the server side */) {
            if (_isTypeObject(this.body) && !isTypeStream(this.body) && !this.frameDone) { // Only ever done when type isn't object-like or when frameClosure says done
                response.headers.set('X-Live-Response-Frame-Tag', 'frame0');
                clientMessagingPort.publishMutations(this.body, 'frame0', { signal: this.#abortController.signal/* stop observing mutations on body when we abort */ });
            }
            // Publish replacements?
            // Only really done when (generatorType = 'Generator' || generatorType = 'Response') and was determined done
            // otherwise, when a replaceWith() call says so
            response.headers.set('X-Live-Response-Generator-Done', this.generatorDone && 'true' || 'false');
            if (!this.generatorDone) {
                const replaceHandler = () => {
                    const headers = Object.fromEntries(this.headers.entries());
                    if (headers?.['set-cookie']) {
                        delete headers['set-cookie'];
                        console.warn('Warning: The "set-cookie" header is not supported for security reasons and has been removed from the response.');
                    }
                    clientMessagingPort.postMessage({
                        body: this.body,
                        status: this.status,
                        statusText: this.statusText,
                        headers,
                        done: this.generatorDone,
                    }, { eventOptions: { type: 'response', live: true/*gracefully ignored if not an object*/ }, liveOptions: { signal: this.#abortController.signal/* stop observing mutations on body when we abort */ } });
                };
                this.addEventListener('replace', replaceHandler, { signal: this.#abortController.signal/* stop listening when we abort */ });
            }
        }
        return response;
    }

    async * toGenerator() {
        do {
            yield $this.body;
        } while (await new Promise((resolve) => {
            this.addEventListener('replace', () => resolve(true), { once: true });
            this.addEventListener('generatordone', () => resolve(false), { once: true });
            this.#abortController.signal.addEventListener('abort', () => resolve(false), { once: true });
        }));
    }

    toQuantum() {
        const state = new StateX;
        const replaceHandler = () => Observer.defineProperty(state, 'value', { value: this.body, enumerable: true, configurable: true });
        this.addEventListener('replace', replaceHandler, { signal: this.#abortController.signal });
        replaceHandler();
        return state;
    }
}

globalThis.LiveResponse = LiveResponse;
