import { _isTypeObject } from '@webqit/util/js/index.js';
import { createFormDataFromJson } from './formdata.js';
import { dataType } from './util.js';

export function renderHttpMessageInit(httpMessageInit) {
    // JSONfy headers
    const headers = (httpMessageInit.headers instanceof Headers) ? [...httpMessageInit.headers.entries()].reduce((_headers, [name, value]) => {
        return { ..._headers, [name/* lower-cased */]: _headers[name] ? [].concat(_headers[name], value) : value };
    }, {}) : Object.keys(httpMessageInit.headers || {}).reduce((_headers, name) => {
        return { ..._headers, [name.toLowerCase()]: httpMessageInit.headers[name] };
    }, {});
    // Process body
    let body = httpMessageInit.body, type = dataType(httpMessageInit.body);
    if (['Blob', 'File'].includes(type)) {
        !headers['content-type'] && (headers['content-type'] = body.type);
        !headers['content-length'] && (headers['content-length'] = body.size);
    } else if (['Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer'].includes(type)) {
        !headers['content-length'] && (headers['content-length'] = body.byteLength);
    } else if (type === 'json' && _isTypeObject(body)/*JSON object*/) {
        if (!headers['content-type']) {
            const [_body, isJsonfiable] = createFormDataFromJson(body, true/*jsonfy*/, true/*getIsJsonfiable*/);
            if (isJsonfiable) {
                body = JSON.stringify(body, (k, v) => v instanceof Error ? { ...v, message: v.message } : v);
                headers['content-type'] = 'application/json';
                headers['content-length'] = (new Blob([body])).size;
            } else {
                body = _body;
                type = 'FormData';
            }
        }
    } else if (type === 'json'/*JSON string*/ && !headers['content-length']) {
        (headers['content-length'] = (body + '').length);
    }
    return { body, headers, $type: type };
}

export async function parseHttpMessage(httpMessage) {
    let result;
    const contentType = httpMessage.headers.get('Content-Type') || '';
    if (contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/form-data')) {
        const formData = await httpMessage.formData();
        result = await formData?.json();
    } else if (contentType.startsWith('application/json')/*can include charset*/) {
        result = await httpMessage.json();
    } else /*if (contentType === 'text/plain')*/ {
        result = httpMessage.body;
    }
    return result;
}
