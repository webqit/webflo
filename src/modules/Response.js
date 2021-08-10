
/**
 * @imports
 */
import { _toTitle, _fromCamel } from "@webqit/util/str/index.js";
import { _from as _arrFrom } from "@webqit/util/arr/index.js";

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
        return true;
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

    set redirect(value) {
        return this.setHeader('Location', value);
    }

    get redirect() {
        return this.getHeader('Location');
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

    set cookies(value) {
        return this.setHeader('Set-Cookie', value);
    }

    get cookies() {
        return this.getHeader('Set-Cookie');
    }
}