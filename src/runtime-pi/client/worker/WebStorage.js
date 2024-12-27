import { AbstractStorage } from '../../AbstractStorage.js';

export class WebStorage extends AbstractStorage {
    #type;

    static async create(storeType) {
        return new this;
    }

    async commit() {
    }
}