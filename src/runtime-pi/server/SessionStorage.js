import { AbstractStorage } from '../AbstractStorage.js';
import crypto from 'crypto';

export class SessionStorage extends AbstractStorage {

    static create(request, params = {}) {
        if (!this.__storage) Object.defineProperty(this, '__storage', { value: new Map });
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
        if (this.__storage.has(sessionID)) {
            return this.__storage.get(sessionID);
        }
        const instance = new this(sessionID);
        this.__storage.set(sessionID, instance);
        return instance;
    }

    #sessionID;
    get sessionID() {
        return this.#sessionID;
    }

    constructor(sessionID) {
        super();
        this.#sessionID = sessionID;
    }

    commit(response, force = false) {
        if (!force && !this.getAdded().length && !this.getDeleted().length) return;
        return response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; SameSite=Strict; expires=Tue, 29 Oct 2026 16:56:32 GMT`);
    }
}