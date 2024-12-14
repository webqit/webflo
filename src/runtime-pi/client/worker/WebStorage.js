import AbstractStorage from '../../AbstractStorage.js';

export default class WebStorage extends AbstractStorage {
    #type;

    static async create(storeType) {
        return new this;
    }

    async commit() {
    }
}