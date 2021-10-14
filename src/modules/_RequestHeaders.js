
/**
 * @imports
 */
import { _after } from "@webqit/util/str/index.js";
import _Headers from './_Headers.js';

/**
 * The _Headers Mixin
 */
const _RequestHeaders = NativeHeaders => class extends _Headers(NativeHeaders) {

    set accepts(value) {
        return this.set('Accepts', value);
    }

    get accepts() {
        const value = this.get('Accepts');
        const AcceptsArr = class extends Array {
            match(max) {
                const _clone = this.slice();
                if (_clone[1] > max - 1) {
                    _clone[1] = max - 1;
                }
                return _clone;
            }
        };
        return value;
    }

    set cookies(cookies) {
        this.set('Cookie', cookies);
        return true;
    }

    get cookies() {
        return this.get('Cookie');
    }

    set cors(value) {
        return this.set('Access-Control-Allow-Origin', value === true ? '*' : (value === false ? '' : value));
    }

    get cors() {
        return this.get('Access-Control-Allow-Origin');
    }

    set range(value) {
        return this.set('Range', Array.isArray(value) ? `bytes=${value.join('-')}` : value);
    }

    get range() {
        const value = this.get('Range');
        if (!value) return;
        const range = _after(value, 'bytes=').split('-');
        range[0] = range[0] ? parseInt(range[0], 10) : 0;
        range[1] = range[1] ? parseInt(range[1], 10) : 0;
        range.clamp = max => {
            if (range[1] > max - 1) {
                range[1] = max - 1;
            }
        };
        return range;
    }

}

export default _RequestHeaders;