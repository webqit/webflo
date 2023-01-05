
/**
 * @imports
 */
import { _isString, _isNumeric, _isObject, _isPlainObject, _isArray, _isPlainArray, _isTypeObject, _isNumber, _isBoolean } from '@webqit/util/js/index.js';
import { _before } from '@webqit/util/str/index.js';
import { params } from './util-url.js';

export function formatMessage(message) {
    const headers = (message.headers instanceof Headers) ? [...message.headers.keys()].reduce((_headers, name) => {
        return { ..._headers, [name/* lower-cased */]: message.headers.get(name) };
    }, {}) : Object.keys(message.headers || {}).reduce((_headers, name) => {
        return { ..._headers, [name.toLowerCase()]: message.headers[name] };
    }, {});
    let body = message.body, type = dataType(message.body);
    if ([ 'Blob', 'File' ].includes(type)) {
        !headers['content-type'] && (headers['content-type'] = body.type);
        !headers['content-length'] && (headers['content-length'] = body.size);
    } else if ([ 'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer' ].includes(type)) {
        !headers['content-length'] && (headers['content-length'] = body.byteLength);
    } else if (type === 'json' && _isTypeObject(body)) {
        if (!headers['content-type']) {
            const [ _body, isJsonfiable ] = formDatarizeJson(body);
            if (isJsonfiable) {
                body = JSON.stringify(body, (k, v) => v instanceof Error ? { ...v, message: v.message } : v);
                headers['content-type'] = 'application/json';
                headers['content-length'] = (new Blob([ body ])).size;
            } else {
                body = _body;
                type = 'FormData';
            }
        }
    } else if (type === 'json') {
        !headers['content-length'] && (headers['content-length'] = (body + '').length);
    }
    return [ body, headers, type ];
}

export function formDatarizeJson(data = {}, jsonfy = true) {
    const formData = new FormData;
    let isJsonfiable = true;
    params.reduceValue(data, '', (value, contextPath, suggestedKeys = undefined) => {
        if (suggestedKeys) {
            const isJson = dataType(value) === 'json';
            isJsonfiable = isJsonfiable && isJson;
            return isJson && suggestedKeys;
        }
        if (jsonfy && [true, false, null].includes(value)) {
            value = new Blob([value], { type: 'application/json' });
        }
        formData.append(contextPath, value);
    });
    return [ formData, isJsonfiable ];
}

export async function jsonfyFormData(formData, jsonfy = true) {
    let isJsonfiable = true;
    let json;
    for (let [ name, value ] of formData.entries()) {
        if (!json) { json = _isNumeric(_before(name, '[')) ? [] : {}; }
        let type = dataType(value);
        if (jsonfy && ['Blob', 'File'].includes(type) && value.type === 'application/json' && [4, 5].includes(value.size)) {
            let _value = await value.text();
            if (['true', 'false', 'null'].includes(_value)) {
                type = 'json';
                value = JSON.parse(_value);
            }
        }
        isJsonfiable = isJsonfiable && type === 'json';
        params.set(json, name, value);
    }
    return [ json, isJsonfiable ];
}

export function dataType(value) {
    if (_isString(value) || _isNumber(value) || _isBoolean(value)) return 'json';
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