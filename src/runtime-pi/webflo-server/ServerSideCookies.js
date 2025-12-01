import { headers as headersShim } from '../webflo-fetch/index.js';
import { HttpCookies } from '../webflo-routing/HttpCookies.js';

export class ServerSideCookies extends HttpCookies {
    static create({ request, thread }) {
        const cookies = headersShim.get.value.call(request.headers, 'Cookie', true);
        return new this({
            request,
            thread,
            entries: cookies.map((c) => [c.name, c])
        });
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