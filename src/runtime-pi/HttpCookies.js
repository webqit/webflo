import { _isObject } from '@webqit/util/js/index.js';
import { renderCookieObj } from './util-http.js';
import { WebfloStorage } from './WebfloStorage.js';

export class HttpCookies extends WebfloStorage {

    #originals;

    constructor(request, iterable = []) {
        iterable = [...iterable].map(([key, value]) => [key, !_isObject(value) ? { name: key, value } : value]);
        super(new Map(iterable), null, request);
        this.#originals = new Map(iterable);
    }

    async set(key, value) {
        if (!_isObject(value)) { value = { name: key, value }; }
        return await super.set(key, value);
    }

    async get(key, withDetail = false) {
        if (!withDetail) return (await super.get(key))?.value;
        return await super.get(key);
    }

    async render() {
        const entries = await Promise.all((await this.keys()).concat(this.#originals.keys()).map(async (key) => {
            const a = this.#originals.get(key);
            const b = await this.get(key, true);
            if (a === b || (_isObject(a) && _isObject(b) && _even(a, b))) {
                // Same
                return;
            }
            if ([undefined, null].includes(b)) {
                // Deleted
                return { name: key, value: '', maxAge: 0 };
            }
            // Added or modified
            return { name: key, ...(await this.get(key, true)) };
        })).then((entries) => entries.filter((e) => e));
        return entries.map((e) => renderCookieObj(e));
    }
}