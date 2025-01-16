import { WebfloCookieStorage } from '../WebfloCookieStorage.js';

export class CookieStorage extends WebfloCookieStorage {
    static create(request) {
        return new this(
            request,
            request.headers.get('Cookie', true).map((c) => [c.name, c])
        );
    }

    commit(response) {
        for (const cookieStr of this.render()) {
            response.headers.append('Set-Cookie', cookieStr);
        }
        super.commit();
    }
}