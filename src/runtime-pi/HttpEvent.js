import { _isEmpty } from '@webqit/util/js/index.js';
import { AbstractCookieStorage } from './AbstractCookieStorage.js';
import { AbstractStorage } from './AbstractStorage.js';
import xURL from "./xURL.js";

export class HttpEvent {

    #request;
    #url;
    #detail;
    #cookies;
    #session;
    #storage;
    #workport;
    #requestCloneCallback;

    constructor(request, detail = {}, cookies = new AbstractCookieStorage, session = new AbstractStorage, storage = new AbstractStorage, workport = null) {
        this.#request = request;
        this.#url = new xURL(this.#request.url);
        this.#detail = detail;
        this.#cookies = cookies;
        this.#session = session;
        this.#storage = storage;
        this.#workport = workport;
    }

    get request() { return this.#request; }

    get url() { return this.#url; }

    get detail() { return this.#detail; }

    get cookies() { return this.#cookies; }

    get session() { return this.#session; }

    get storage() { return this.#storage; }

    get workport() { return this.#workport; }

    set onRequestClone(callback) {
        this.#requestCloneCallback = callback;
    }

    clone() {
        const request = this.#requestCloneCallback?.() || this.#request;
        const detail = this.#detail;
        const cookies = this.#cookies;
        const session = this.#session;
        const storage = this.#storage;
        const workport = this.#workport;
        const instance = new this.constructor(request, detail, cookies, session, storage, workport);
        instance.#requestCloneCallback = this.#requestCloneCallback;
        return instance;
    }

    redirect(url, code = 302) {
        return new Response(null, { status: code, headers: { Location: url } });
    }

    async with(url, init = {}) {
        let request, _;
        if (url instanceof Request) {
            if (init instanceof Request) { [ /*url*/, init ] = await Request.copy(init); }
            request = !_isEmpty(init) ? new Request(url, init) : url;
        } else {
            url = new xURL(url, this.#url.origin);
            init = await Request.copy(this.#request, init);
            request = new Request(url, { ...init, referrer: this.#request.url });
        }            
        return new HttpEvent(request, this.#detail, this.#cookies, this.#session, this.#storage);
    }
}