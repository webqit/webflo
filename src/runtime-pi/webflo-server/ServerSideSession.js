import { HttpSession } from '../webflo-routing/HttpSession.js';
import { headers as headersShim } from '../webflo-fetch/index.js';

export class ServerSideSession extends HttpSession {

    static create({ store, request, sessionID, ttl }) {
        return new this({
            store,
            request,
            sessionID,
            ttl
        });
    }

    #sessionID;
    get sessionID() { return this.#sessionID; }
    #ttl;
    
    constructor({ store, request, sessionID, ttl }) {
        if (!sessionID) {
            throw new Error(`sessionID is required`);
        }
        super({
            store,
            request,
            session: true
        });
        this.#sessionID = sessionID;
        this.#ttl = ttl;
    }

    async commit(response = null, devMode = false) {
        if (response && !headersShim.get.value.call(response.headers, 'Set-Cookie', true).find((c) => c.name === '__sessid')) {
            // expires six months
            response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; ${!devMode ? 'Secure; ' : ''}HttpOnly; SameSite=Lax${this.#ttl ? `; Max-Age=${this.#ttl}` : ''}`);
        }
        await super.commit();
    }
}