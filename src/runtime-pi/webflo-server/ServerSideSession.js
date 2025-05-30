import { HttpSession } from '../webflo-routing/HttpSession.js';
import crypto from 'crypto';

export class ServerSideSession extends HttpSession {

    static create({ store, request, secret, ttl }) {
        let sessionID = request.headers.get('Cookie', true).find((c) => c.name === '__sessid')?.value;
        if (sessionID?.includes('.')) {
            if (secret) {
                const [rand, signature] = sessionID.split('.');
                const expectedSignature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                if (signature !== expectedSignature) {
                    sessionID = undefined;
                }
            } else {
                sessionID = null;
            }
        }
        if (!sessionID) {
            if (secret) {
                const rand = `${(0 | Math.random() * 9e6).toString(36)}`;
                const signature = crypto.createHmac('sha256', secret)
                    .update(rand)
                    .digest('hex');
                sessionID = `${rand}.${signature}`
            } else {
                sessionID = crypto.randomUUID();
            }
        }
        return new this({
            store: typeof store === 'function' ? store(sessionID) : store,
            request,
            sessionID,
            secret,
            ttl
        });
    }

    #secret;
    #ttl;
    #sessionID;
    get sessionID() { return this.#sessionID; }
    
    constructor({ store, request, sessionID, secret, ttl }) {
        if (!sessionID) {
            throw new Error(`sessionID is required`);
        }
        super({
            store,
            request,
            session: true
        });
        this.#sessionID = sessionID;
        this.#secret = secret;
        this.#ttl = ttl;
    }

    async commit(response = null) {
        if (response && !response.headers.get('Set-Cookie', true).find((c) => c.name === '__sessid')) {
            // expires six months
            response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; SameSite=Lax${this.#ttl ? `; Max-Age=${this.#ttl}` : ''}`);
        }
        await super.commit();
    }
}