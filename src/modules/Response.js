
/**
 * @imports
 */
import { _toTitle, _fromCamel, _after, _beforeLast } from "@webqit/util/str/index.js";
import { _isString, _getType, _isObject } from "@webqit/util/js/index.js";

export default class Response {

    // construct
    constructor(definition) {
        // We have the request instance in scope.
        this._request = this.constructor._request;
        Object.keys(definition).forEach(prop => {
            var value = definition[prop];
            if (['contentType', 'cacheControl', 'redirect', 'cors', 'cookies'].includes(prop)) {
                this[prop] = value;
            } else {
                Object.defineProperty(this, prop, { value, enumerable:true });
            }
        });
    }

    setHeader(name, value) {
        if (!this.headers) {
            Object.defineProperty(this, 'headers', { value: {}, enumerable:true });
        }
        this.headers[name.includes('-') ? name : _fromCamel(_toTitle(name), '-')] = value;
        return this;
    }

    getHeader(name) {
        return Object.keys(this.headers || {}).reduce((val, _name) => val || (_name.toLowerCase() === name.toLowerCase() ? this.headers[_name] : null), null);
    }

    set contentType(value) {
        return this.setHeader('Content-Type', value);
    }

    get contentType() {
        return this.getHeader('Content-Type');
    }

    set cookies(cookieJar) {
        if (!_isObject(cookieJar)) {
            throw new Error(`The "cookies" response directive does not support the type: ${_getType(cookieJar)}`);
        }
        this.setHeader('Set-Cookie', cookieJar);
        return true;
    }

    get cookies() {
        return this.getHeader('Set-Cookie');
    }

    set redirect(value) {
        return this.setHeader('Location', value);
    }

    get redirect() {
        return this.getHeader('Location');
    }

    set download(value) {
        value = value === true ? 'attachment' : (value === false ? 'inline' : value);
        if (!_isString(value)) {
            throw new Error(`The "download" response directive does not support the type: ${_getType(value)}`);
        }
        if (!['attachment', 'inline'].includes(value)) {
            value = `attachment; filename="${value}"`;
        }
        return this.setHeader('Content-Disposition', value);
    }

    get download() {
        var value = (this.getHeader('Content-Disposition') || '').trim();
        value = value === 'attachment' ? true : (
            value === 'inline' ? false : _after(_beforeLast(value, '"'), 'filename="')
        );
        return value;
    }

    set cors(value) {
        return this.setHeader('Access-Control-Allow-Origin', value === true ? '*' : (value === false ? '' : value));
    }

    get cors() {
        return this.getHeader('Access-Control-Allow-Origin');
    }

    set cacheControl(value) {
        return this.setHeader('Cache-Control', value);
    }

    get cacheControl() {
        return this.getHeader('Cache-Control');
    }
}