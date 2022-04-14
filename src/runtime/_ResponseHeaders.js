
/**
 * @imports
 */
import { _after, _beforeLast } from "@webqit/util/str/index.js";
import { _isString, _getType, _isObject } from "@webqit/util/js/index.js";
import _Headers from './_Headers.js';

/**
 * The _Headers Mixin
 */
const _ResponseHeaders = NativeHeaders => class extends _Headers(NativeHeaders) {

    set contentRange(value) {
        if (Array.isArray(value)) {
            if ((value.length === 2 && !value[0].includes('-')) || value.length < 2) {
                throw new Error(`A Content-Range array must be in the format: [ 'start-end', 'total' ]`);
            }
            return this.set('Content-Range', `bytes ${value.join('/')}`);
        }
        if (!this.has('Accept-Ranges')) {
            this.set('Accept-Ranges', 'bytes');
        }
        return this.set('Content-Range', value);
    }

    get contentRange() {
        const value = this.get('Content-Range');
        if (!value) return;
        return _after(value, 'bytes ').split('/');
    }

    set cookies(cookieStr) {
        if (!_isObject(cookieJar)) {
            throw new Error(`The "cookies" response directive does not support the type: ${_getType(cookieStr)}`);
        }
        this.set('Set-Cookie', cookieStr);
        return true;
    }

    get cookies() {
        return this.get('Set-Cookie');
    }

    set cors(value) {
        return this.set('Access-Control-Allow-Origin', value === true ? '*' : (value === false ? '' : value));
    }

    get cors() {
        return this.get('Access-Control-Allow-Origin');
    }

    set attachment(value) {
        value = value === true ? 'attachment' : (value === false ? 'inline' : value);
        if (!_isString(value)) {
            throw new Error(`The "download" response directive does not support the type: ${_getType(value)}`);
        }
        if (![ 'attachment', 'inline' ].includes(value)) {
            value = `attachment; filename="${value}"`;
        }
        return this.set('Content-Disposition', value);
    }

    get attachment() {
        var value = (this.get('Content-Disposition') || '').trim();
        value = value === 'attachment' ? true : (
            value === 'inline' ? false : _after(_beforeLast(value, '"'), 'filename="')
        );
        return value;
    }

    get location() {
        return this.get('Location');
    }

    set location(value) {
        return this.set('Location', value);
    }

    get redirect() {
        return this.get('Location');
    }

    set redirect(value) {
        return this.set('Location', value);
    }

}

export default _ResponseHeaders;