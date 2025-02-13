import { WebfloStorage } from '../../WebfloStorage.js';

export class SessionStorage extends WebfloStorage {
    static create(request) {
        return new this(request);
    }

    constructor(request) {
        super(request, true);
    }

    async commit(response) {
        await super.commit();
    }
}