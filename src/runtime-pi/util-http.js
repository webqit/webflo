
/**
 * @imports
 */
import { _isString, _isNumeric, _isObject, _isPlainObject, _isArray, _isPlainArray, _isTypeObject, _isNumber } from '@webqit/util/js/index.js';
import { _before } from '@webqit/util/str/index.js';
import { params } from './util-url.js';

export function formatMessage(body) {
    let type = dataType(body);
    let headers = {};
    if ([ 'Blob', 'File' ].includes(type)) {
        headers = { 'Content-Type': body.type,  'Content-Length': body.size, };
    } else if ([ 'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer' ].includes(type)) {
        headers = {  'Content-Length': body.byteLength, };
    } else if (type === 'json' && _isTypeObject(body)) {
        const [ _body, isJsonfiable ] = formData(body);
        if (isJsonfiable) {
            body = JSON.stringify(body, (k, v) => v instanceof Error ? { ...v, message: v.message } : v);
            headers = { 'Content-Type': 'application/json', 'Content-Length': (new Blob([ body ])).size, };
        } else {
            body = _body;
            type = 'FormData';
        }
    } else if (type === 'json') {
        headers = { 'Content-Length': (body + '').length, };
    }
    return [ body, headers, type ];
}

export function formData(data = {}) {
    const formData = this instanceof FormData ? this : new FormData;
    let isJsonfiable = true;
    if (arguments.length) {
        params.reduceValue(data, '', (value, contextPath, suggestedKeys = undefined) => {
            if (suggestedKeys) {
                const isJson = dataType(value) === 'json';
                isJsonfiable = isJsonfiable && isJson;
                return isJson && suggestedKeys;
            }
            formData.append(contextPath, value);
        });
        return [ formData, isJsonfiable ];
    }
    let json;
    for (let [ name, value ] of formData.entries()) {
        if (!json) { json = _isNumeric(_before(name, '[')) ? [] : {}; }
        const isJson = dataType(value) === 'json';
        isJsonfiable = isJsonfiable && isJson;
        if (value === 'false') { value = false; }
        if (value === 'true') { value = true; }
        if (value === 'null') { value = null; }
        if (value === 'undefined') { value = undefined; }
        params.set(json, name, value);
    }
    return [ json, isJsonfiable ];
}

export function dataType(value) {
    if (_isString(value) || _isNumber(value) || value === null) return 'json';
    if (!_isTypeObject(value)) return;
    const toStringTag = value[Symbol.toStringTag];
    const type = [
        'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer', 'Blob', 'File', 'FormData', 'Stream', 'ReadableStream'
    ].reduce((_toStringTag, type) => _toStringTag || (toStringTag === type ? type : null), null);
    if (type) return type;
    if ((_isObject(value) && _isPlainObject(value)) || (_isArray(value) && _isPlainArray(value)) || 'toString' in value) {
        return 'json';
    }
}