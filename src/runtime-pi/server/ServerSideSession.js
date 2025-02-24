import { HttpSession } from '../HttpSession.js';
import crypto from 'crypto';

export class ServerSideSession extends HttpSession {

    static create(storageCallback, request, params = {}) {
        let sessionID = request.headers.get('Cookie', true).find((c) => c.name === '__sessid')?.value;
        if (sessionID?.includes('.')) {
            if (params.secret) {
                const [rand, signature] = sessionID.split('.');
                const expectedSignature = crypto.createHmac('sha256', params.secret)
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
            if (params.secret) {
                const rand = `${(0 | Math.random() * 9e6).toString(36)}`;
                const signature = crypto.createHmac('sha256', params.secret)
                    .update(rand)
                    .digest('hex');
                sessionID = `${rand}.${signature}`
            } else {
                sessionID = crypto.randomUUID();
            }
        }
        return new this(
            storageCallback(sessionID),
            request,
            { sessionID, ...params }
        );
    }

    #params;
    #sessionID;
    get sessionID() { return this.#sessionID; }
    
    constructor(store, request, { sessionID, ...params } = {}) {
        if (!sessionID) {
            throw new Error(`sessionID is required`);
        }
        super(
            store,
            request,
            true
        );
        this.#params = params;
        this.#sessionID = sessionID;
    }

    async commit(response = null) {
        if (response && !response.headers.get('Set-Cookie', true).find((c) => c.name === '__sessid')) {
            // expires six months
            response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; SameSite=Lax${this.#params.ttl ? `; Max-Age=${this.#params.ttl}` : ''}`);
        }
        await super.commit();
    }
}