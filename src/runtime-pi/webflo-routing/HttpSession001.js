import { HttpKeyvalInterface } from './HttpKeyvalInterface.js';

export class HttpSession001 extends HttpKeyvalInterface {

    #sessionID;
    get sessionID() { return this.#sessionID; }
    
    constructor({ context = {}, store, request, thread, sessionID }) {
        if (!sessionID) {
            throw new Error(`sessionID is required`);
        }
        super({
            context,
            store,
            request,
            thread,
            sessionID,
        });
        this.#sessionID = sessionID;
    }
}