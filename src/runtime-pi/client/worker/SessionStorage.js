import { WebfloStorage } from '../../WebfloStorage.js';

export class SessionStorage extends WebfloStorage {
    #type;

    static async create(request) {
        return new this;
    }

    async commit(response) {
    }
}