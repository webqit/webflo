import { HttpCookies } from '../routing-apis/HttpCookies.js';

export class ClientSideCookies extends HttpCookies {
    static create(request) {
        return new this(
            request,
            document.cookie.split(';').map((c) => c.split('=').map((s) => s.trim()))
        );
    }

    async commit(response) {
        for (const cookieStr of await this.render()) {
            document.cookie = cookieStr;
        }
        await super.commit();
    }
}