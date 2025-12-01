import { HttpCookies } from '../webflo-routing/HttpCookies.js';

export class ClientSideCookies extends HttpCookies {
    static create({ request, thread }) {
        return new this({
            request,
            thread,
            entries: document.cookie.split(';').map((c) => c.split('=').map((s) => s.trim()))
        });
    }

    async commit(response) {
        for (const cookieStr of await this.render()) {
            document.cookie = cookieStr;
        }
        await super.commit();
    }
}