import { _wq as __wq } from '@webqit/util/js/index.js';

export const _wq = (target, ...args) => __wq(target, 'webflo', ...args);

export const _await = (value, callback) => {
    if (value instanceof Promise) {
        return value.then(callback);
    }
    return callback(value);
};
