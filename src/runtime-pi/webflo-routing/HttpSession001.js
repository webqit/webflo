import { HttpKeyvalInterface } from './HttpKeyvalInterface.js';

export class HttpSession001 extends HttpKeyvalInterface {

    #sessionID;
    get sessionID() { return this.#sessionID; }
    #ttl;
    
    constructor({ context = {}, store, request, thread, sessionID, ttl }) {
        if (!sessionID) {
            throw new Error(`sessionID is required`);
        }
        super({
            context,
            store,
            request,
            thread,
            sessionID,
            ttl
        });
        this.#sessionID = sessionID;
        this.#ttl = ttl;
    }
}