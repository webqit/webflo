import { HttpCookies } from '../../HttpCookies.js';

export class WorkerSideCookies extends HttpCookies {
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