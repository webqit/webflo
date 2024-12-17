import { _isString, _isNumeric, _isObject, _isPlainObject, _isArray, _isPlainArray, _isTypeObject, _isNumber, _isBoolean } from '@webqit/util/js/index.js';
import { _after, _before } from '@webqit/util/str/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';
import { params } from './util-url.js';

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

export function renderHttpMessageInit(httpMessageInit) {
    const headers = (httpMessageInit.headers instanceof Headers) ? [...httpMessageInit.headers.keys()].reduce((_headers, name) => {
        return { ..._headers, [name/* lower-cased */]: httpMessageInit.headers.get(name) };
    }, {}) : Object.keys(httpMessageInit.headers || {}).reduce((_headers, name) => {
        return { ..._headers, [name.toLowerCase()]: httpMessageInit.headers[name] };
    }, {});
    let body = httpMessageInit.body, type = dataType(httpMessageInit.body);
    if (['Blob', 'File'].includes(type)) {
        !headers['content-type'] && (headers['content-type'] = body.type);
        !headers['content-length'] && (headers['content-length'] = body.size);
    } else if (['Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer'].includes(type)) {
        !headers['content-length'] && (headers['content-length'] = body.byteLength);
    } else if (type === 'json' && _isTypeObject(body)) {
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
    } else if (type === 'json') {
        !headers['content-length'] && (headers['content-length'] = (body + '').length);
    }
    return { body, headers, $type: type };
}

export async function parseHttpMessage(httpMessage) {
    let result;
    const contentType = httpMessage.headers.get('Content-Type') || '';
    if (contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/form-data')) {
        const formData = await httpMessage.formData();
        result = await formData?.json();
    } else if (contentType === 'application/json') {
        result = await httpMessage.json();
    } else if (contentType === 'text/plain') {
        result = await httpMessage.text();
    }
    return result;
}

export function createFormDataFromJson(data = {}, jsonfy = true, getIsJsonfiable = false) {
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
    if (getIsJsonfiable) return [formData, isJsonfiable];
    return formData;
}

export async function renderFormDataToJson(formData, jsonfy = true, getIsJsonfiable = false) {
    let isJsonfiable = true;
    let json;
    for (let [name, value] of formData.entries()) {
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
    if (getIsJsonfiable) return [json, isJsonfiable];
    return json;
}

export function renderCookieObj(cookieObj) {
    const attrsArr = [`${cookieObj.name}=${/*encodeURIComponent*/(cookieObj.value)}`];
    for (const attrName in cookieObj) {
        if (['name', 'value'].includes(attrName)) continue;
        let _attrName = attrName[0].toUpperCase() + attrName.substring(1);
        if (_attrName === 'MaxAge') { _attrName = 'Max-Age' };
        attrsArr.push(cookieObj[attrName] === true ? _attrName : `${_attrName}=${cookieObj[attrName]}`);
    }
    return attrsArr.join(';');
}

/* Request */

Object.defineProperties(Request, {
    create: {
        value: function (url, init = {}) {
            if (url instanceof Request) return url;
            let $$type, $$body = init.body;
            if ('body' in init) {
                const { body, headers, $type } = renderHttpMessageInit(init);
                init = { ...init, body, headers };
                $$type = $type;
            }
            const instance = new Request(url, init);
            instance.meta.body = $$body;
            instance.meta.type = $$type;
            return instance;
        }
    },

    copy: {
        value: async function (request) {
            const requestInit = [
                'method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity',
            ].reduce((init, prop) => ({ [prop]: request[prop], ...init }), {});
            if (!['GET', 'HEAD'].includes(request.method)) {
                requestInit.body = await request.clone().arrayBuffer();
            }
            if (requestInit.mode === 'navigate') {
                requestInit.mode = 'cors';
            }
            return { url: request.url, ...requestInit };
        }
    }
});

Object.defineProperties(Request.prototype, {
    parse: { value: function() { return parseHttpMessage(this); } },
    meta: { get: function() { if (!this._meta) this._meta = {}; return this._meta; } }
});

/* Response */

Object.defineProperties(Response, {
    create: {
        value: function (body, init = {}) {
            if (body instanceof Response) return body;
            let $type, $body = body;
            if (body || body === 0) {
                let headers;
                ({ body, headers, $type } = renderHttpMessageInit({ body, headers: init.headers }));
                init = { ...init, headers };
            }
            const instance = new Response(body, init);
            instance.meta.body = $body;
            instance.meta.type = $type;
            return instance;
        }
    }
});

const statusGet = Object.getOwnPropertyDescriptor(Response.prototype, 'status');
Object.defineProperties(Response.prototype, {
    parse: { value: function() { return parseHttpMessage(this); } },
    meta: { get: function() { if (!this._meta) this._meta = {}; return this._meta; } },
    status: { get: function() { return this.meta.status || statusGet.get.call(this); } }
});

/* Headers */

const { set: headerSet, append: headerAppend, get: headerGet } = Headers.prototype;
Object.defineProperties(Headers.prototype, {
    set: {
        value: function (name, value) {
            // -------------------------
            // Format "Set-Cookie" response header
            if (/Set-Cookie/i.test(name) && _isObject(value)) {
                value = renderCookieObj(value);
            }
            // -------------------------
            // Format "Cookie" request header
            if (/Cookie/i.test(name) && _isTypeObject(value)) {
                value = [].concat(value).map(renderCookieObj).join(';');
            }
            // -------------------------
            // Format "Content-Range" response header?
            if (/Content-Range/i.test(name) && Array.isArray(value)) {
                if (value.length < 2 || !value[0].includes('-')) {
                    throw new Error(`A Content-Range array must be in the format: [ 'start-end', 'total' ]`);
                }
                value = `bytes ${value.join('/')}`;
            }
            // -------------------------
            // Format "Range" request header?
            if (/Range/i.test(name)) {
                let rangeArr = [];
                _arrFrom(value).forEach((range, i) => {
                    let rangeStr = Array.isArray(range) ? range.join('-') : range + '';
                    if (i === 0 && !rangeStr.includes('bytes=')) {
                        rangeStr = `bytes=${rangeStr}`;
                    }
                    rangeArr.push(rangeStr);
                });
                value = rangeArr.join(', ');
            }
            // -------------------------
            // Format "Accept" request header?
            if (/Accept/i.test(name) && Array.isArray(value)) {
                value = value.join(',');
            }
            // -------------------------
            return headerSet.call(this, name, value);
        }
    },

    append: {
        value: function (name, value) {
            // -------------------------
            // Format "Set-Cookie" response header
            if (/Set-Cookie/i.test(name) && _isObject(value)) {
                value = renderCookieObj(value);
            }
            // -------------------------
            return headerAppend.call(this, name, value);
        }
    },

    get: {
        value: function (name, parsed = false) {
            let value = headerGet.call(this, name);
            // -------------------------
            // Parse "Set-Cookie" response header
            if (/Set-Cookie/i.test(name) && parsed) {
                value = this.getSetCookie()/*IMPORTANT*/.map((str) => {
                    const [cookieDefinition, attrsStr] = str.split(';');
                    const [name, value] = cookieDefinition.split('=').map((s) => s.trim());
                    const cookieObj = { name, value: /*decodeURIComponent*/(value), };
                    attrsStr && attrsStr.split(/\;/g).map(attrStr => attrStr.trim().split('=')).forEach(attrsArr => {
                        cookieObj[attrsArr[0][0].toLowerCase() + attrsArr[0].substring(1).replace('-', '')] = attrsArr.length === 1 ? true : attrsArr[1];
                    });
                    return cookieObj;
                });
            }
            // -------------------------
            // Parse "Cookie" request header
            if (/Cookie/i.test(name) && parsed) {
                value = value?.split(';').map((str) => {
                    const [name, value] = str.split('=').map((s) => s.trim());
                    return { name, value: /*decodeURIComponent*/(value), };
                }) || [];
            }
            // -------------------------
            // Parse "Content-Range" response header?
            if (/Content-Range/i.test(name) && value && parsed) {
                value = _after(value, 'bytes ').split('/');
            }
            // -------------------------
            // Parse "Range" request header?
            if (/Range/i.test(name) && parsed) {
                value = !value ? [] : _after(value, 'bytes=').split(',').map((rangeStr) => {
                    let range = rangeStr.trim().split('-');
                    range[0] = range[0] ? parseInt(range[0], 10) : undefined;
                    if (range[1]) {
                        range[1] = parseInt(range[1], 10);
                    }
                    range.clamp = max => {
                        if (range[1] > max - 1 || range[1] === undefined) {
                            range[1] = max - 1;
                        }
                        if (range[0] === undefined) range[0] = range[1] ? max - range[1] - 1 : 0;
                    };
                    return range;
                });
            }
            // -------------------------
            // Parse "Accept" request header?
            if (/Accept/i.test(name) && parsed) {
                const list = value && value.split(',')
                    .map((a) => (a = a.trim().split(';').map(a => a.trim()), [a.shift(), parseFloat((a.pop() || '1').replace('q=', ''))]))
                    .sort((a, b) => a[1] > b[1] ? -1 : 1) || [];
                value = {
                    match(mime) {
                        mime = (mime + '').split('/');
                        return list.reduce((prev, entry) => prev || (
                            (entry = entry[0].split('/')) && [0, 1].every(i => ((mime[i] === entry[i]) || mime[i] === '*' || entry[i] === '*'))
                        ), false);
                    },
                    toString() {
                        return value;
                    }
                };
            }
            // -------------------------
            return value;
        }
    }
});

/* FormData */

Object.defineProperties(FormData, {
    json: { value: createFormDataFromJson }
});

Object.defineProperties(FormData.prototype, {
    json: {
        value: async function (data = {}) {
            const result = await renderFormDataToJson(this, ...arguments);
            return result;
        }
    }
});