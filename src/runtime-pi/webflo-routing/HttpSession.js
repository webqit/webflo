import { HttpState } from './HttpState.js';

export class HttpSession extends HttpState {
    static create({ store, request }) {
        return new this({
            store,
            request,
            session: true
        });
    }
}