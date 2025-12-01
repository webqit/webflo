import { HttpState } from './HttpState.js';

export class HttpSession extends HttpState {
    static create({ store, request, thread }) {
        return new this({
            store,
            request,
            thread
        });
    }
}