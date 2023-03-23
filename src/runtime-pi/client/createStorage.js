

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
    const _storage = {}, key = e => namespace ? `${namespace}.${e.key}` : e.key;
    Observer.intercept(_storage, {
        get: (event, received, next) => {
            if (!_isString(event.key)) return;
            const value = window[storeType].getItem(key(event));
            return next(!_isUndefined(value) ? JSON.parse(value) : value);
        },
        set: (event, received, next) => {
            if (!_isString(event.key)) return;
            window[storeType].setItem(key(event), !_isUndefined(event.value) ? JSON.stringify(event.value) : event.value);
            return next(true);
        },
        deleteProperty: (event, received, next) => {
            if (!_isString(event.key)) return;
            window[storeType].removeItem(key(event));
            return next(true);
        },
        has: (event, received, next) => {
            if (!_isString(event.key)) return;
            const _key = key(event);
            for(let i = 0; i < window[storeType].length; i ++){
                if (window[storeType].key(i) === _key) {
                    return next(true);
                }
            };
            return next(false);
        },
        ownKeys: (event, received, next) => {
            const keys = [];
            for(let i = 0; i < window[storeType].length; i ++){
                keys.push(window[storeType].key(i));
            };
            return next(keys);
        },
        getOwnPropertyDescriptor: (event, received, next) => {
            return next({ enumerable: true, configurable: true });
        },
    });

    return Observer.proxy(_storage);
}

export {
    Observer,
}