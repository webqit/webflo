import { _isObject } from '@webqit/util/js/index.js';
import { renderCookieObj } from './util-http.js';
import { WebfloStorage } from './WebfloStorage.js';

export class WebfloCookieStorage extends WebfloStorage {
    constructor(request, iterable = []) {
        iterable = [...iterable].map(([key, value]) => [key, !_isObject(value) ? { name: key, value } : value]);
        super(request, iterable);
    }

    render() {
        return this.getAdded().map((key) => renderCookieObj({ name: key, ...this.get(key, true) })).concat(
            this.getDeleted().map((key) => renderCookieObj({ name: key, value: '', maxAge: 0 }))
        );
    }

    set(key, value) {
        if (!_isObject(value)) { value = { name: key, value }; }
        return super.set(key, value);
    }

    get(key, withDetail = false) {
        if (!withDetail) return super.get(key)?.value;
        return super.get(key);
    }
}