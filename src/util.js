import { _wq as $wq } from '@webqit/util/js/index.js';

export const _wq = (target, ...args) => $wq(target, 'webflo', ...args);
export const _meta = (target, ...args) => $wq(target, 'webflo', 'meta', ...args);

export const _await = (value, callback) => {
    if (value instanceof Promise) {
        return value.then(callback);
    }
    return callback(value);
};
