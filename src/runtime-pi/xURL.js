
/**
 * @imports
 */
import { _isObject, _isArray } from '@webqit/util/js/index.js';
import { params } from './util-url.js';

/**
 * ---------------------------
 * The xURL Mixin
 * ---------------------------
 */
export default class xURL extends URL {
	
	// constructor
	constructor(...args) {
		super(...args);
		var query = params.parse(this.search);
		const updateSearch = query => {
			// "query" was updated. So we update "search"
			var search = params.stringify(query);
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
		var query = params.parse(value);
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
xURL.Observable = class extends xURL {

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

