import { AbstractStorage } from '../AbstractStorage.js';

export class WebStorage extends AbstractStorage {

    static create(storeType) {
        const keys = [];
		for(let i = 0; i < window[storeType].length; i ++){
			keys.push(window[storeType].key(i));
		};
        const instance = new this(keys.map((key) => [key, window[storeType].getItem(key)]));
        instance.#type = storeType;
        return instance;
    }

    #type;

    commit() {
        for (const key of this.getAdded()) {
            window[this.#type].setItem(key, this.get(key));
        }
        for (const key of this.getDeleted()) {
            window[this.#type].removeItem(key);
        }
    }
}