import { HttpCookies } from '../webflo-routing/HttpCookies.js';
import { headers as headersShim } from '../webflo-fetch/index.js';

export class WorkerSideCookies extends HttpCookies {
    static create({ request, thread }) {
        return new this({
            request,
            thread,
            entries: headersShim.get.value.call(request.headers, 'Cookie', true).map((c) => [c.name, c])
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