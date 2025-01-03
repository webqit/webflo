import { _isEmpty } from '@webqit/util/js/index.js';
import { AbstractCookieStorage } from './AbstractCookieStorage.js';
import { AbstractStorage } from './AbstractStorage.js';
import xURL from "./xURL.js";

export class HttpEvent {

    static create(init) {
        return new this(init);
    }

    #init;
    #url;
    #requestCloneCallback;

    constructor(init) {
        this.#init = init;
        this.#url = new xURL(init.request.url);
    }

    get url() { return this.#url; }

    get request() { return this.#init.request; }

    get detail() { return this.#init.detail; }

    get cookies() { return this.#init.cookies; }

    get session() { return this.#init.session; }

    get user() { return this.#init.user; }

    get workport() { return this.#init.workport; }

    set onRequestClone(callback) {
        this.#requestCloneCallback = callback;
    }

    clone() {
        const request = this.#requestCloneCallback?.() || this.request;
        const init = { ...this.#init, request };
        const instance = this.constructor.create(init);
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
            init = await Request.copy(this.request, init);
            request = new Request(url, { ...init, referrer: this.request.url });
        }            
        return new HttpEvent(request, this.detail, this.cookies, this.session, this.storage);
    }
}