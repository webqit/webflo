import { AbstractStorage } from '../../AbstractStorage.js';

export class SessionStorage extends AbstractStorage {
    #type;

    static async create(request) {
        return new this;
    }

    async commit(response) {
    }
}