import { WebfloStorage } from '../WebfloStorage.js';

export class SessionStorage extends WebfloStorage {
    static get type() { return 'session'; }

    static create(request) {
        const keys = [];
        const storeType = this.type === 'user' ? 'localStorage' : 'sessionStorage';
		for(let i = 0; i < window[storeType].length; i ++){
			keys.push(window[storeType].key(i));
		};
        const instance = new this(
            request,
            keys.map((key) => [key, window[storeType].getItem(key)])
        );
        return instance;
    }

    commit() {
        const storeType = this.constructor.type === 'user' ? 'localStorage' : 'sessionStorage';
        for (const key of this.getAdded()) {
            window[storeType].setItem(key, this.get(key));
        }
        for (const key of this.getDeleted()) {
            window[storeType].removeItem(key);
        }
        super.commit();
    }
}