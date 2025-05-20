
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
		const query = params.parse(this.search);
		const updateSearch = () => {
			// "query" was updated. So we update "search"
			let search = params.stringify(query);
			search = search ? '?' + search : '';
			if (search !== this.search) {
				this.search = search;
			}
		};
		const $this = this;
		this._query = new Proxy(query, {
			set(t, k, v) {
				t[k] = v;
				if (!$this._updatingSearch) updateSearch();
				return true;
			},
			deleteProperty(t, k) {
				delete t[k];
				if (!$this._updatingSearch) updateSearch();
				return true;
			}
		});
	}

	// Set search
	set search(value) {
		super.search = value;
		// "search" was updated. So we update "query"
		this._updatingSearch = true;
		const query = params.parse(value);
		const keys_a = Object.keys(query);
		const keys_b = Object.keys(this._query);
		for (const k of new Set([...keys_a,...keys_b])) {
			if (!keys_a.includes(k)) delete this.query[k];
			if (!keys_b.includes(k)) this.query[k] = query[k];
		}
		this._updatingSearch = false;
	}

	// Get search
	get search() {
		return super.search;
	}

	// Get query
	get query() {
		return this._query;
	}

};
// ----------
xURL.Observable = class extends xURL {

	constructor() {
		super(...arguments);
		const { Observer } = webqit;
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

