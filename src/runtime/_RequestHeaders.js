
/**
 * @imports
 */
import { _after } from "@webqit/util/str/index.js";
import _Headers from './_Headers.js';
import { wwwFormUnserialize } from './util.js';

/**
 * The _Headers Mixin
 */
const _RequestHeaders = NativeHeaders => class extends _Headers(NativeHeaders) {

    set accept(value) {
        return this.set('Accept', value);
    }

    get accept() {
        const list = (this.get('Accept') || '')
            .split(',').map(a => (a = a.trim().split(';').map(a => a.trim()), [a.shift(), parseFloat((a.pop() || '1').replace('q=', ''))]))
            .sort((a, b) => a[1] > b[1] ? -1 : 1);
        return {
            match(mime) {
                mime = (mime + '').split('/');
                return list.reduce((prev, entry) => prev || (
                    (entry = entry[0].split('/')) && [0, 1].every(i => ((mime[i] === entry[i]) || mime[i] === '*' || entry[i] === '*'))
                ), false);
            }
        };
    }

    set cookies(cookies) {
        this.set('Cookie', cookies);
        return true;
    }

    get cookies() {
        if (!this._cookies) {
            this._cookies = wwwFormUnserialize(this.get('cookie'), {}, ';');
        }
        return this._cookies;
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