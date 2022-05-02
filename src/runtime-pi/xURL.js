
/**
 * @imports
 */
import _isArray from '@webqit/util/js/isArray.js';
import _isObject from '@webqit/util/js/isObject.js';
import { wwwFormUnserialize, wwwFormSerialize } from './util.js';

/**
 * ---------------------------
 * The xURL Mixin
 * ---------------------------
 */
const xURL = whatwagURL => {
	const URL = class extends whatwagURL {
		
		// constructor
		constructor(...args) {
			super(...args);
			var query = wwwFormUnserialize(this.search);
			const updateSearch = query => {
				// "query" was updated. So we update "search"
				var search = wwwFormSerialize(query);
				search = search ? '?' + search : '';
				if (search !== this.search) {
					this.search = search;
				}
			};
			this.__query = {
				value: query,
				proxy: new Proxy(query, {
					set(t, n, v) {
						t[n] = v;
						updateSearch(t);
						return true;
					},
					deleteProperty(t, n) {
						delete t[n];
						updateSearch(t);
						return true;
					}
				})
			};
		}

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

		// Get query
		get query() {
			return this.__query.proxy;
		}

	};
	// ----------
    URL.Observable = class extends URL {
	
		constructor() {
			super(...arguments);
			const { Observer } = WebQit;
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
	
	};
    // ----------
	return URL;
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

export default xURL;