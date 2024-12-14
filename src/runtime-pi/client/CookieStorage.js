import AbstractCookieStorage from '../AbstractCookieStorage.js';

export default class CookieStorage extends AbstractCookieStorage {
    static create() {
        return new this(document.cookie.split(';').map((c) => c.split('=').map((s) => s.trim())));
    }

    commit() {
        for (const cookieStr of this.render()) {
            document.cookie = cookieStr;
        }
    }
}