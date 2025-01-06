import { AbstractStorage } from '../AbstractStorage.js';
import crypto from 'crypto';

export class SessionStorage extends AbstractStorage {

    static create(request, params = {}) {
        if (!SessionStorage.__storage) Object.defineProperty(SessionStorage, '__storage', { value: new Map });
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
        if (SessionStorage.__storage.has(sessionID)) {
            return SessionStorage.__storage.get(sessionID);
        }
        const instance = new this(request, sessionID);
        SessionStorage.__storage.set(sessionID, instance);
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
        return response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; expires=Tue, 29 Oct 2026 16:56:32 GMT`);
    }
}