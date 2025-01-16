import { WebfloStorage } from '../WebfloStorage.js';
import crypto from 'crypto';

const sessionStorage = new Map;
export class SessionStorage extends WebfloStorage {

    static create(request, params = {}) {
        let sessionID = request.headers.get('Cookie', true).find((c) => c.name === '__sessid')?.value;
        if (sessionID?.includes('.')) {
            const [rand, signature] = sessionID.split('.');
            const expectedSignature = crypto.createHmac('sha256', params.secret)
                .update(rand)
                .digest('hex');
            if (signature !== expectedSignature) {
                sessionID = undefined;
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
        if (sessionStorage.has(sessionID)) {
            return sessionStorage.get(sessionID);
        }
        const instance = new this(request, sessionID);
        sessionStorage.set(sessionID, instance);
        return instance;
    }

    constructor(request, sessionID) {
        super(request);
        this.#sessionID = sessionID;
    }

    #sessionID;
    get sessionID() {
        return this.#sessionID;
    }

    commit(response, force = false) {
        if (response.headers.get('Set-Cookie', true).find((c) => c.name === '__sessid')) return;
        if (!force && !this.getAdded().length && !this.getDeleted().length) return;
        response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000`);
        super.commit();
    }
}