import { WebfloCookieStorage } from '../../WebfloCookieStorage.js';

export class CookieStorage extends WebfloCookieStorage {
    static create(request) {
        return new this(
            request,
            request.headers.get('Cookie', true).map((c) => [c.name, c])
        );
    }

    async commit(response = null) {
        if (response) {
            for (const cookieStr of await this.render()) {
                response.headers.append('Set-Cookie', cookieStr);
            }
        }
        await super.commit();
    }
}