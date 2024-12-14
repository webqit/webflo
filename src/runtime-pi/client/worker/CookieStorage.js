import AbstractCookieStorage from '../../AbstractCookieStorage.js';

export default class CookieStorage extends AbstractCookieStorage {
    static create(request) {
        return new this(request.headers.get('Cookie', true).map((c) => [c.name, c]));
    }

    commit(response) {
        for (const cookieStr of this.render()) {
            response.headers.append('Set-Cookie', cookieStr);
        }
    }
}