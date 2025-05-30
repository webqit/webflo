import { _isString, _isObject, _isPlainObject, _isPlainArray, _isTypeObject, _isNumber, _isBoolean } from '@webqit/util/js/index.js';

export const meta = Symbol('meta');

export function isTypeStream(obj) {
    return obj instanceof ReadableStream || isTypeReadable(obj);
}

export function isTypeReadable(obj) {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        typeof obj.read === 'function' &&       // streams have .read()
        typeof obj.pipe === 'function' &&       // streams have .pipe()
        typeof obj.on === 'function'            // streams have event listeners
    );
}

export function dataType(value) {
    if (_isString(value) || _isNumber(value) || _isBoolean(value)) return 'json';
    if (!_isTypeObject(value)) return;
    const toStringTag = value[Symbol.toStringTag];
    const type = [
        'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer', 'Blob', 'File', 'FormData', 'Stream', 'ReadableStream'
    ].reduce((_toStringTag, type) => _toStringTag || (toStringTag === type ? type : null), null);
    if (type) return type;
    if ((_isObject(value) && _isPlainObject(value)) || (Array.isArray(value) && _isPlainArray(value)) || 'toString' in value) {
        return 'json';
    }
}