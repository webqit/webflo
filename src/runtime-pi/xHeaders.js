
/**
 * @imports
 */
import { _after, _beforeLast } from "@webqit/util/str/index.js";
import { _isString, _getType, _isObject, _isFunction } from "@webqit/util/js/index.js";
import { _isTypeObject } from '@webqit/util/js/index.js';

/**
 * The xHeaders Mixin
 */
const xHeaders = whatwagHeaders => class extends whatwagHeaders {

    // construct
    constructor(definition = {}) {
        const cookies = definition.cookies;
        delete definition.cookies;
        // -----------------        
        if (definition instanceof whatwagHeaders) {
            // It's another Headers instance
            super(definition);
        } else {
            super();
            this.json(definition);
        }
        // -----------------        
        this.cookies = cookies;
    }

    set(name, value) {
        // Will sync forth to this._cookies if is cookie
        this.catchCookies(name, value);
        return super.set(name, value);
    }
    
    append(name, value) {
        // Will sync forth to this._cookies if is cookie
        this.catchCookies(name, value, true);
        return super.append(name, value);
    }
        
    delete(name) {
        // Will sync forth to this._cookies if is cookie
        this.catchCookies(name);
        return super.delete(name);
    }

    set cookies(cookies) {
        if (cookies instanceof Map) {
            this.cookies.clear();
            for (let [ name, value ] of cookies) {
                this.cookies.set(name, value);
            }
        } else if (cookies) { this.set(this.cookieHeaderName, cookies); }
        return true;
    }

    get cookies() {
        if (!this._cookies) {
            this._cookies = new this.Cookies;
            Object.defineProperty(this._cookies, 'headers', { value: this });
        }
        return this._cookies;
    }
        
    catchCookies(name, value, append = false) {
        if (!this.cookies || name.toLowerCase() !== this.cookieHeaderName.toLowerCase()) return;
        this.cookies.outLock = true;
        // -----------------
        if (arguments.length > 1) {
            if (!append) {  this.cookies.clear(); }
            const cookiesObj = this.cookies.parse(value);
            for (let name in cookiesObj) {
                this.cookies.set(name, cookiesObj[name]);
            }
        } else { this.cookies.clear(); }
        // -----------------
        this.cookies.outLock = false;
    }

    json(headers = {}, replace = true) {
        if (arguments.length) {
            const _setters = getAllPropertyDescriptors(this);
            const setters = Object.keys(_setters).reduce((list, key) => list.concat((typeof key !== 'symbol') && ('set' in _setters[key]) ? key : []), []);
            Object.keys(headers).forEach(name => {
                var nameCs = setters.reduce((prev, curr) => prev || (curr === name || curr.toLocaleLowerCase() === name ? curr : null), null);
                if (nameCs) {
                    if (replace || this[nameCs] === undefined) {
                        this[nameCs] = headers[name];
                    }
                } else {
                    if (replace || !this.has(name)) {
                        this.set(name, headers[name]);
                    }
                }
            });
            return;
        }
        const _headers = {};
        for (var [ name, value ] of this) {
            _headers[name] = value;
        }
        return _headers;
    }

    set cacheControl(value) {
        return this.set('Cache-Control', value);
    }

    get cacheControl() {
        return this.get('Cache-Control');
    }

    set contentLength(value) {
        return this.set('Content-Length', value);
    }

    get contentLength() {
        return this.get('Content-Length');
    }
    
    set contentType(value) {
        return this.set('Content-Type', value);
    }

    get contentType() {
        return this.get('Content-Type');
    }

    static compat(headers) {
        if (!(headers instanceof this) && !headers.json) {
            const descs = getAllPropertyDescriptors(new this);
            Object.keys(descs).forEach(key => {
                if (typeof key === 'symbol' || (key in headers)) return;
                Object.defineProperty(headers, key, descs[key]);
            });
        }
        return headers;
    }

}

export default xHeaders;

function getAllPropertyDescriptors(obj) {
    if (!obj) {
        return Object.create(null);
    } else {
        const proto = Object.getPrototypeOf(obj);
        return proto === Object.prototype ? {} : {
            ...getAllPropertyDescriptors(proto),
            ...Object.getOwnPropertyDescriptors(obj)
        };
    }
}