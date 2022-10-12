
/**
 * @imports
 */
import { _isString, _isObject } from "@webqit/util/js/index.js";

export default class Cookies extends Map {

    constructor(...args) {
        super(...args);
        Object.defineProperty(this, 'inLock', { value: false, writable: true });
        Object.defineProperty(this, 'outLock', { value: false, writable: true });
    }

    set(name, value) {
        if (this.inLock) return;
        if (this.has(name)) this.delete(name);
        this.inLock = true;
        // -----------------
        let valueObj = value, valueStr = value, retrn;
        if (_isString(value)) { valueObj = this.parseEntry(`=${ value }`)[1]; }
        retrn = super.set(name, valueObj);
        if (!this.outLock) {
            if (_isObject(value)) { valueStr = this.stringifyEntry(value); }
            append(this.headers, `${ name }=${ valueStr }`);
        }
        // -----------------
        this.inLock = false;
        return retrn;
    }

    delete(name) {
        if (this.inLock) return;
        this.inLock = true;
        // -----------------
        let retrn = super.delete(name);
        this.headers.delete(this.headers.cookieHeaderName);
        for (let [ name, definition ] of this) {
            append(this.headers, `${ name }=${ this.stringifyEntry(definition) }`);
        }
        // -----------------
        this.inLock = false;
        return retrn;
    }

    clear() {
        if (this.inLock) return;
        this.inLock = true;
        // -----------------
        let retrn = super.clear();
        this.headers.delete(this.headers.cookieHeaderName);
        // -----------------
        this.inLock = false;
        return retrn;
    }

    json(json = {}) {
        if (arguments.length) {
            this.clear();
            for (let name in json) {
                this.set(name, json[name])
            }
            return;
        }
        for (let [ name, definition ] of this) {
            json[name] = definition;
        }
        return json;
    }

    toString() {
        return this.headers.get(this.headers.cookieHeaderName);
    }

}

function append(headers, value) {
    let values = [value];
    let currentValue = headers.get(headers.cookieHeaderName);
    if (currentValue) { values.unshift(currentValue); }
    headers.set(headers.cookieHeaderName, values.join(headers.cookieHeaderSeparator));
}