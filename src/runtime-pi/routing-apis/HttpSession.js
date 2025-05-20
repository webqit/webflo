import { WebfloStorage } from './WebfloStorage.js';

export class HttpSession extends WebfloStorage {
    static create(store, request) {
        return new this(
            store,
            request,
            true
        );
    }
}