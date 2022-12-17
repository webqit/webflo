

/**
 * @imports
 */
import { _isString, _isUndefined } from '@webqit/util/js/index.js';
import { Observer } from './Runtime.js';

export default function(namespace = null, persistent = false) {

    const storeType = persistent ? 'localStorage' : 'sessionStorage';
    if (!window[storeType]) {
        throw new Error(`The specified Web Storage API ${storeType} is invalid or not supported`);
    }

    const _storage = {};
    Observer.intercept(_storage, (event, received, next) => {
        const key = namespace ? `${namespace}.${event.name}` : event.name;
        if (event.type === 'get' && _isString(key)) {
            const value = window[storeType].getItem(key);
            return !_isUndefined(value) ? JSON.parse(value) : value;
        }
        if (event.type === 'set') {
            window[storeType].setItem(key, !_isUndefined(event.value) ? JSON.stringify(event.value) : event.value);
            return true;
        }
        if (event.type === 'deleteProperty') {
            window[storeType].removeItem(key);
            return true;
        }
        if (event.type === 'has') {
            for(let i = 0; i < window[storeType].length; i ++){
                if (window[storeType].key(i) === key) {
                    return true;
                }
            };
            return false;
        }
        if (event.type === 'ownKeys') {
            const keys = [];
            for(let i = 0; i < window[storeType].length; i ++){
                keys.push(window[storeType].key(i));
            };
            return keys;
        }
        if (event.type === 'getOwnPropertyDescriptor') {
            return { enumerable: true, configurable: true };
        }
        return next();
    });

    return Observer.proxy(_storage);
}

export {
    Observer,
}