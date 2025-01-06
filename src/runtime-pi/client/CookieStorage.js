import { AbstractCookieStorage } from '../AbstractCookieStorage.js';

export class CookieStorage extends AbstractCookieStorage {
    static create(request) {
        return new this(
            request,
            document.cookie.split(';').map((c) => c.split('=').map((s) => s.trim()))
        );
    }

    commit(response) {
        for (const cookieStr of this.render()) {
            document.cookie = cookieStr;
        }
    }
}