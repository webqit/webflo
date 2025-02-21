import { WebfloStorage } from '../WebfloStorage.js';
import crypto from 'crypto';

const inmemSessionRegistry = new Map;
export class SessionStorage extends WebfloStorage {

    static create(request, params = {}) {
        let sessionID = request.headers.get('Cookie', true).find((c) => c.name === '__sessid')?.value;
        console.log({params});
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
        return new this(params.registry || inmemSessionRegistry, sessionID, request);
    }

    #sessionID;
    get sessionID() { return this.#sessionID; }
    
    constructor(reqistry, sessionID, request) {
        super(
            reqistry,
            `session:${sessionID}`,
            request,
            true
        );
        this.#sessionID = sessionID;
    }

    async commit(response = null) {
        if (response && !response.headers.get('Set-Cookie', true).find((c) => c.name === '__sessid')) {
            // expires six months
            response.headers.append('Set-Cookie', `__sessid=${this.#sessionID}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=15768000`);
        }
        await super.commit();
    }
}