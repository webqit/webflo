import { _isObject, _isTypeObject, _isNumeric } from '@webqit/util/js/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
import { DeepURLSearchParams } from '../webflo-url/util.js';
import { dataType } from './util.js';
import { _wq } from '../../util.js';
import { Observer } from '@webqit/use-live';
import { LiveResponse } from './LiveResponse.js';

// ----- env & globalize

export const env = {};

export function shim(prefix = 'wq') {
    const apis = [Request, Response, Headers, FormData];
    const descs = [request, response, headers, formData];
    const patch = (api, desc) => {
        const _descs = Object.fromEntries(Object.entries(desc).map(([key, value]) => {
            if (prefix && key in api) {
                key = `${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
            }
            return [key, value];
        }));
        Object.defineProperties(api, _descs);
    };
    for (let i = 0; i < apis.length; i++) {
        const api = apis[i];
        const { prototype, ...statics } = descs[i];
        patch(api, statics);
        if (prototype) {
            patch(api.prototype, prototype);
        }
    }
    globalThis.LiveResponse = LiveResponse;
    globalThis.Observer = Observer;
}

// ----- request

const requestOriginals = { prototype: { clone: Request.prototype.clone } };

export const request = {
    from: {
        value: function (url, init = {}) {
            if (url instanceof Request) return url;
            let $$type, $$body = init.body;
            if ('body' in init) {
                const { body, headers, $type } = renderHttpMessageInit(init);
                init = { ...init, body, headers };
                $$type = $type;
            }
            const instance = new Request(url, init);
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', $$body);
            responseMeta.set('type', $$type);
            return instance;
        }
    },
    copy: {
        value: async function (request, init = {}) {
            const attrs = ['method', 'headers', 'mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity'];
            const requestInit = attrs.reduce(($init, prop) => (
                {
                    ...$init,
                    [prop]: prop in init
                        ? init[prop]
                        : (prop === 'headers'
                            ? new Headers(request[prop])
                            : request[prop])
                }
            ), {});
            if (!['GET', 'HEAD'].includes(init.method?.toUpperCase() || request.method)) {
                if ('body' in init) {
                    requestInit.body = init.body
                    if (!('headers' in init)) {
                        requestInit.headers.delete('Content-Type');
                        requestInit.headers.delete('Content-Length');
                    }
                } else {
                    requestInit.body = await request.clone().arrayBuffer();
                }
            }
            if (requestInit.mode === 'navigate') {
                requestInit.mode = 'cors';
            }
            return { url: request.url, ...requestInit };
        }
    },
    prototype: {
        carries: {
            get: function () {
                return _wq(this, 'meta').get('carries') || [];
            }
        },
        parse: { value: async function () { return await parseHttpMessage(this); } },
        clone: {
            value: function (init = {}) {
                const clone = requestOriginals.prototype.clone.call(this, init);
                const requestMeta = _wq(this, 'meta');
                _wq(clone).set('meta', requestMeta);
                return clone;
            }
        },
    }
};

// ----- response

const responseOriginals = {
    json: Response.json,
    prototype: {
        status: Object.getOwnPropertyDescriptor(Response.prototype, 'status'),
        clone: Response.prototype.clone,
    },
};

export const response = {
    json: {
        value: function (data, options = {}) {
            const instance = responseOriginals.json(data, options);
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', data);
            responseMeta.set('type', 'json');
            return instance;
        }
    },
    from: {
        value: function (body, init = {}) {
            if (body instanceof Response) return body;
            let $type, $body = body;
            if (body || body === 0) {
                let headers;
                ({ body, headers, $type } = renderHttpMessageInit({ body, headers: init.headers }));
                init = { ...init, headers };
            }
            const instance = new Response(body, init);
            const responseMeta = _wq(instance, 'meta');
            responseMeta.set('body', $body);
            responseMeta.set('type', $type);
            return instance;
        }
    },
    prototype: {
        status: {
            get: function () {
                return _wq(this, 'meta').get('status')
                    || (this instanceof Response
                        ? responseOriginals.prototype.status.get.call(this)
                        : this.status);
            }
        },
        carry: { get: function () { return _wq(this, 'meta').get('carry'); } },
        parse: { value: async function () { return await parseHttpMessage(this); } },
        clone: {
            value: function (init = {}) {
                const clone = responseOriginals.prototype.clone.call(this, init);
                const responseMeta = _wq(this, 'meta');
                _wq(clone).set('meta', responseMeta);
                return clone;
            }
        },
    }
};

// ----- headers

const headersOriginals = {
    set: Headers.prototype.set,
    get: Headers.prototype.get,
    append: Headers.prototype.append,
};

export const headers = {
    set: {
        value: function (name, value) {

            // Format "Set-Cookie" response header
            if (/^Set-Cookie$/i.test(name) && _isObject(value)) {
                value = renderCookieObjToString(value);
            }

            // Format "Cookie" request header
            if (/Cookie/i.test(name) && _isTypeObject(value)) {
                value = [].concat(value).map(renderCookieObjToString).join(';');
            }

            // Format "Content-Range" response header?
            if (/^Content-Range$/i.test(name) && Array.isArray(value)) {
                if (value.length < 2 || !value[0].includes('-')) {
                    throw new Error(`A Content-Range array must be in the format: [ 'start-end', 'total' ]`);
                }
                value = `bytes ${value.join('/')}`;
            }

            // Format "Range" request header?
            if (/^Range$/i.test(name)) {
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

            // Format "Accept" request header?
            if (/^Accept$/i.test(name) && Array.isArray(value)) {
                value = value.join(',');
            }

            return headersOriginals.set.call(this, name, value);
        }
    },
    append: {
        value: function (name, value) {

            // Format "Set-Cookie" response header
            if (/^Set-Cookie$/i.test(name) && _isObject(value)) {
                value = renderCookieObjToString(value);
            }

            return headersOriginals.append.call(this, name, value);
        }
    },
    get: {
        value: function (name, parsed = false) {
            let value = headersOriginals.get.call(this, name);

            // Parse "Set-Cookie" response header
            if (/^Set-Cookie$/i.test(name) && parsed) {
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

            // Parse "Cookie" request header
            if (/^Cookie$/i.test(name) && parsed) {
                value = value?.split(';').map((str) => {
                    const [name, value] = str.split('=').map((s) => s.trim());
                    return { name, value: /*decodeURIComponent*/(value), };
                }) || [];
            }

            // Parse "Content-Range" response header?
            if (/^Content-Range$/i.test(name) && value && parsed) {
                value = _after(value, 'bytes ').split('/');
            }

            // Parse "Range" request header?
            if (/^Range$/i.test(name) && parsed) {
                value = !value ? [] : _after(value, 'bytes=').split(',').map((rangeStr) => {
                    const range = rangeStr.trim().split('-').map((s) => s ? parseInt(s, 10) : null);
                    range.render = (totalLength) => {
                        if (range[1] === null) {
                            range[1] = totalLength - 1;
                        }
                        if (range[0] === null) {
                            range[0] = range[1] ? totalLength - range[1] - 1 : 0;
                        }
                        return range
                    };
                    range.isValid = (currentStart, totalLength) => {
                        // Start higher than end or vice versa?
                        if (range[0] > range[1] || range[1] < range[0]) return false;
                        // Stretching beyond valid start/end?
                        if (range[0] < currentStart || range[1] > totalLength) return false;
                        return true;
                    };
                    return range;
                });
            }

            // Parse "Accept" request header?
            if (/^Accept$/i.test(name) && value && parsed) {
                const parseSpec = (spec) => {
                    const [mime, q] = spec.trim().split(';').map((s) => s.trim());
                    return [mime, parseFloat((q || 'q=1').replace('q=', ''))];
                };
                const list = value.split(',')
                    .map((spec) => parseSpec(spec))
                    .sort((a, b) => a[1] > b[1] ? -1 : 1) || [];
                const $value = value;
                value = {
                    match(mime) {
                        if (!mime) return 0;
                        const splitMime = (mime) => mime.split('/').map((s) => s.trim());
                        const $mime = splitMime(mime + '');
                        return list.reduce((prev, [entry, q]) => {
                            if (prev) return prev;
                            const $entry = splitMime(entry);
                            return [0, 1].every((i) => (($mime[i] === $entry[i]) || $mime[i] === '*' || $entry[i] === '*')) ? q : 0;
                        }, 0);
                    },
                    toString() {
                        return $value;
                    }
                };
            }

            return value;
        }
    }
};

// ----- formData

export const formData = {
    json: { value: createFormDataFromJson },
    prototype: {
        json: {
            value: async function (data = {}) {
                const result = await renderFormDataToJson(this, ...arguments);
                return result;
            }
        }
    }
};

// ----- Utils

export function renderHttpMessageInit(httpMessageInit) {
    // JSONfy headers
    const headers = (httpMessageInit.headers instanceof Headers) ? [...httpMessageInit.headers.entries()].reduce((_headers, [name, value]) => {
        return { ..._headers, [name/* lower-cased */]: _headers[name] ? [].concat(_headers[name], value) : value };
    }, {}) : Object.keys(httpMessageInit.headers || {}).reduce((_headers, name) => {
        return { ..._headers, [name.toLowerCase()]: httpMessageInit.headers[name] };
    }, {});
    // Process body
    let body = httpMessageInit.body,
        type = dataType(httpMessageInit.body);

    if (['Blob', 'File'].includes(type)) {
        !headers['content-type'] && (headers['content-type'] = body.type);
        !headers['content-length'] && (headers['content-length'] = body.size);
    } else if (['Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer'].includes(type)) {
        !headers['content-length'] && (headers['content-length'] = body.byteLength);
    } else if (type === 'json' && _isTypeObject(body)/*JSON object*/) {
        const [_body, isJsonfiable] = createFormDataFromJson(body, true/*jsonfy*/, true/*getIsJsonfiable*/);
        if (isJsonfiable) {
            body = JSON.stringify(body, (k, v) => v instanceof Error ? { ...v, message: v.message } : v);
            headers['content-type'] = 'application/json';
            headers['content-length'] = (new Blob([body])).size;
        } else {
            body = _body;
            type = 'FormData';
        }
    } else if (type === 'json'/*JSON string*/ && !headers['content-length']) {
        (headers['content-length'] = (body + '').length);
    }
    return { body, headers, $type: type };
}

export async function parseHttpMessage(httpMessage) {
    if (!httpMessage.body) return null;
    let result;
    const contentType = httpMessage.headers.get('Content-Type') || '';
    if (contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/form-data')) {
        const fd = await httpMessage.formData();
        result = fd && await formData.prototype.json.value.call(fd);
    } else if (contentType.startsWith('application/json')/*can include charset*/) {
        result = await httpMessage.json();
    } else /*if (contentType === 'text/plain')*/ {
        result = httpMessage.body;
    }
    return result;
}

// -----

export function createFormDataFromJson(data = {}, jsonfy = true, getIsJsonfiable = false) {
    const formData = new FormData;
    let isJsonfiable = true;
    DeepURLSearchParams.reduceValue(data, '', (value, contextPath, suggestedKeys = undefined) => {
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
        if (jsonfy && ['Blob', 'File'].includes(type) && value.type === 'application/json') {
            let _value = await value.text();
            value = JSON.parse(_value);
            type = 'json';
        }
        isJsonfiable = isJsonfiable && type === 'json';
        DeepURLSearchParams.set(json, name, value);
    }
    if (getIsJsonfiable) return [json, isJsonfiable];
    return json;
}

// -----

export function renderCookieObjToString(cookieObj) {
    const attrsArr = [`${cookieObj.name}=${/*encodeURIComponent*/(cookieObj.value)}`];
    for (const attrName in cookieObj) {
        if (['name', 'value'].includes(attrName)) continue;
        let _attrName = attrName[0].toUpperCase() + attrName.substring(1);
        if (_attrName === 'MaxAge') { _attrName = 'Max-Age' };
        attrsArr.push(cookieObj[attrName] === true ? _attrName : `${_attrName}=${cookieObj[attrName]}`);
    }
    return attrsArr.join('; ');
}