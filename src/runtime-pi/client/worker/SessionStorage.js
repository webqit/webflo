import { WebfloStorage } from '../../WebfloStorage.js';

export class SessionStorage extends WebfloStorage {
    static create(request) {
        return new this({}, null, request);
    }

    async commit(response = null) {
        await super.commit();
    }
}