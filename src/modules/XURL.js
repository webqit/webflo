
/**
 * @imports
 */
import { Observer } from '@webqit/pseudo-browser/index2.js';
import _isArray from '@webqit/util/js/isArray.js';
import _isObject from '@webqit/util/js/isObject.js';
import { wwwFormUnserialize, wwwFormSerialize } from './util.js';

/**
 * ---------------------------
 * URLX Mixin
 * ---------------------------
 */
export const _URLX = BaseURL => class URL extends BaseURL {
	
	// Set search
	set search(value) {
		super.search = value;
		// "search" was updated. So we update "query"
		var query = wwwFormUnserialize(value);
		if (!_strictEven(query, this.query)) {
			this.query = query;
		}
	}

	// Get search
	get search() {
		return super.search;
	}
	
	// Set query
	set query(value) {
		const current  = () => this.__query.value;
		const updateSearch = query => {
			// "query" was updated. So we update "search"
			var search = wwwFormSerialize(query);
			search = search ? '?' + search : '';
			if (search !== this.search) {
				this.search = search;
			}
		};
		this.__query = {
			value,
			proxy: new Proxy(value, {
				set(t, n, v) {
					t[n] = v;
					if (t === current()) {
						updateSearch(t);
					}
					return true;
				},
				deleteProperty(t, n) {
					delete t[n];
					if (t === current()) {
						updateSearch(t);
					}
					return true;
				}
			})
		};
		updateSearch(value);
	}

	// Get query
	get query() {
		if (!this.__query) {
			this.query = {};
		}
		return this.__query.proxy;
	}

}

/**
 * ---------------------------
 * URLXX Mixin
 * ---------------------------
 */
export const _URLXX = BaseURL => class URL extends _URLX(BaseURL) {
	
	constructor() {
		super(...arguments);
		Observer.accessorize(this, [
			'protocol', 
			'username',
			'password',
			'host',
			'hostname',
			'port',
			'origin',
			'pathname',
			'search',
			'query',
			'hash',
			'href',
		]);
	}

}

/**
 * ---------------------------
 * Helpers
 * ---------------------------
 */
var _strictEven = (a, b) => {
	if (_isObject(a) && _isObject(b)) {
		return _strictEven(Object.keys(a), Object.keys(b)) 
		&& _strictEven(Object.values(a), Object.values(b));
	}
	if (_isArray(a) && _isArray(b)) {
		return a.length === b.length 
		&& a.reduce((recieved, item, i) => recieved && item === b[i], true);
	}
	return a === b;
};

/**
 * ---------------------------
 * URLX Classes
 * ---------------------------
 */
const URLX = _URLX(URL);
export default URLX;

/**
 * ---------------------------
 * URLXX Classes
 * ---------------------------
 */
export const URLXX = _URLXX(URL);