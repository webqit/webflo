import { _after } from '@webqit/util/str/index.js';
import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';
import { renderCookieObjToString } from './cookies.js';

const { set: headerSet, append: headerAppend, get: headerGet } = Headers.prototype;
Object.defineProperties(Headers.prototype, {
    set: {
        value: function (name, value) {
            // -------------------------
            // Format "Set-Cookie" response header
            if (/^Set-Cookie$/i.test(name) && _isObject(value)) {
                value = renderCookieObjToString(value);
            }
            // -------------------------
            // Format "Cookie" request header
            if (/Cookie/i.test(name) && _isTypeObject(value)) {
                value = [].concat(value).map(renderCookieObjToString).join(';');
            }
            // -------------------------
            // Format "Content-Range" response header?
            if (/^Content-Range$/i.test(name) && Array.isArray(value)) {
                if (value.length < 2 || !value[0].includes('-')) {
                    throw new Error(`A Content-Range array must be in the format: [ 'start-end', 'total' ]`);
                }
                value = `bytes ${value.join('/')}`;
            }
            // -------------------------
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
            // -------------------------
            // Format "Accept" request header?
            if (/^Accept$/i.test(name) && Array.isArray(value)) {
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
            if (/^Set-Cookie$/i.test(name) && _isObject(value)) {
                value = renderCookieObjToString(value);
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
            // -------------------------
            // Parse "Cookie" request header
            if (/^Cookie$/i.test(name) && parsed) {
                value = value?.split(';').map((str) => {
                    const [name, value] = str.split('=').map((s) => s.trim());
                    return { name, value: /*decodeURIComponent*/(value), };
                }) || [];
            }
            // -------------------------
            // Parse "Content-Range" response header?
            if (/^Content-Range$/i.test(name) && value && parsed) {
                value = _after(value, 'bytes ').split('/');
            }
            // -------------------------
            // Parse "Range" request header?
            if (/^Range$/i.test(name) && parsed) {
                value = !value ? [] : _after(value, 'bytes=').split(',').map((rangeStr) => {
                    const range = rangeStr.trim().split('-');
                    range[0] = range[0] ? parseInt(range[0], 10) : undefined;
                    if (range[1]) {
                        range[1] = parseInt(range[1], 10);
                    }
                    range.clamp = (totalLength) => {
                        if (range[1] > totalLength - 1 || range[1] === undefined) {
                            range[1] = totalLength - 1;
                        }
                        if (range[0] === undefined) {
                            range[0] = range[1] ? totalLength - range[1] - 1 : 0;
                        }
                        return range
                    };
                    range.isValid = (totalLength = 0) => {
                        return !(range[0] < 0 || (totalLength && range[0] > totalLength)
                            || (range[1] > -1 && (range[1] <= range[0] || (totalLength && range[1] >= totalLength))));
                    };
                    return range;
                });
            }
            // -------------------------
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
            // -------------------------
            return value;
        }
    }
});
