import { _isEmpty } from '@webqit/util/js/index.js';
import CookieStore from './AbstractCookieStorage.js';
import Store from './AbstractStorage.js';
import xURL from "./xURL.js";

export default class HttpEvent {

    #request;
    #url;
    #detail;
    #cookies;
    #session;
    #storage;

    constructor(request, detail = {}, cookies = new CookieStore, session = new Store, storage = new Store) {
        this.#request = request;
        this.#url = new xURL(this.#request.url);
        this.#detail = detail;
        this.#cookies = cookies;
        this.#session = session;
        this.#storage = storage;
    }

    get request() { return this.#request; }

    get url() { return this.#url; }

    get detail() { return this.#detail; }

    get cookies() { return this.#cookies; }

    get session() { return this.#session; }

    get storage() { return this.#storage; }

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
            ({ url: _, ...init } = await Request.copy(this.#request));
            request = new Request(url, { ...init, referrer: this.#request.url });
        }            
        return new HttpEvent(request, this.#detail, this.#cookies, this.#session, this.#storage);
    }

}