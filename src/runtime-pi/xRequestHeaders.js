
/**
 * @imports
 */
import { _after } from "@webqit/util/str/index.js";
import { _from as _arrFrom } from "@webqit/util/arr/index.js";
import { params } from './util-url.js';
import xHeaders from './xHeaders.js';
import xCookies from './Cookies.js';

/**
 * The xHeaders Mixin
 */
export default class xRequestHeaders extends xHeaders {
    
    get cookieHeaderName() {
        return 'Cookie';
    }
        
    get cookieHeaderSeparator() {
        return ';';
    }

    get Cookies() {
        return Cookies;
    }

    set accept(value) {
        return this.set('Accept', value);
    }

    get accept() {
        const accept = this.get('Accept');
        const list = accept && accept.split(',').map(a => (a = a.trim().split(';').map(a => a.trim()), [a.shift(), parseFloat((a.pop() || '1').replace('q=', ''))]))
            .sort((a, b) => a[1] > b[1] ? -1 : 1) || [];
        return {
            match(mime) {
                mime = (mime + '').split('/');
                return list.reduce((prev, entry) => prev || (
                    (entry = entry[0].split('/')) && [0, 1].every(i => ((mime[i] === entry[i]) || mime[i] === '*' || entry[i] === '*'))
                ), false);
            },
            toString() {
                return accept;
            }
        };
    }

    set range(value) {
        let rangeArr = [];
        _arrFrom(value).forEach((range, i) => {
            let rangeStr = Array.isArray(range) ? range.join('-') : range + '';
            if (i === 0 && !rangeStr.includes('bytes=')) {
                rangeStr = `bytes=${rangeStr}`;
            }
            rangeArr.push(rangeStr);
        });
        return this.set('Range', rangeArr.join(', '));
    }

    get range() {
        const value = this.get('Range');
        if (!value) return;
        const rangeArr = _after(value, 'bytes=').split(',').map(rangeStr => {
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
        return rangeArr;
    }

    set cors(value) {
        return this.set('Access-Control-Allow-Origin', value === true ? '*' : (value === false ? '' : value));
    }

    get cors() {
        return this.get('Access-Control-Allow-Origin');
    }


}

/**
 * Cookies
 */
class Cookies extends xCookies {

    parse(str) {
        return params.parse(str, ';');
    }
    
    parseEntry(str) {
        return str.trim().split('=');
    }

    stringifyEntry(cookieBody) {
        return cookieBody;
    }

}