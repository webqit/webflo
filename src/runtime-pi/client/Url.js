
/**
 * @imports
 */
import { _with } from '@webqit/util/obj/index.js';
import { _isArray, _isObject, _isTypeObject, _isString, _isEmpty } from '@webqit/util/js/index.js';
import { Observer } from './Runtime.js';
import { params } from '../util-url.js';

/**
 * ---------------------------
 * The Url class
 * ---------------------------
 */

export default class Url {

	/**
	 * Constructs a new Url instance.
	 *
     * @param object input
     * @param object pathMappingScheme
     * 
	 * @return void
	 */
	constructor(input) {
        const Self = this.constructor;
		// -----------------------
		// Helpers
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
		Observer.intercept(this, 'set', (e, prev, next) => {
			if (e.key === 'hash' && e.value && !e.value.startsWith('#')) {
				return next('#' + e.value);
			}
			if (e.key === 'search' && e.value && !e.value.startsWith('?')) {
				return next('?' + e.value);
			}
			return next();
		});
		// -----------------------
		// When any one of these properties change,
		// the others are automatically derived
		Observer.observe(this, changes => {
			var urlObj = {};
			var onlyHrefChanged;
			for (var e of changes) {
				// ----------
				if (e.key === 'href' && e.related.length === 1) {
					var urlObj = Self.parseUrl(e.value);
					delete urlObj.query;
					delete urlObj.href;
					onlyHrefChanged = true;
				}
				// ----------
				if (e.key === 'query' && (e.path?.length > 1 || !e.related.includes('search'))) {
					// "query" was updated. So we update "search"
					var search = Self.toSearch(this.query); // Not e.value, as that might be a subtree value
					if (search !== this.search) {
						urlObj.search = search;
					}
				}
				if (e.key === 'search') {
					// "search" was updated. So we update "query"
					var query = Self.toQuery(urlObj.search || this.search); // Not e.value, as that might be a href value
					if (!_strictEven(query, this.query)) {
						urlObj.query = query;
					}
				}
			}
			if (!onlyHrefChanged) {
				var fullOrigin = this.origin,
					usernamePassword = [ this.username, this.password ].filter(a => a);
				if (usernamePassword.length === 2) {
					fullOrigin = `${this.protocol}//${usernamePassword.join(':')}@${this.hostname}${(this.port ? `:${this.port}` : '')}`;
				}
				var href = [ fullOrigin, urlObj.pathname || this.pathname, urlObj.search || this.search, this.hash ].join('');
				if (href !== this.href) {
					urlObj.href = href;
				}
			}
			if (!_isEmpty(urlObj)) {
				return Observer.set(this, urlObj);
			}
		}, { subtree:true/*for pathmap/pathsplit/query updates*/, diff: true });
		// -----------------------
		// Validate e.detail
		Observer.observe(this, changes => {
			changes.forEach(e => {
				if (e && e.detail) {
					if (!_isTypeObject(e.detail)) {
						throw new Error('"e.detail" can only be of type object.');
					}
					if (e.detail.request && !_isObject(e.detail.request)) {
						throw new Error('"e.detail.request" can only be of type object.');
					}
				}
			});
		}, {diff: true});
		// -----------------------
		// Startup properties
        Observer.set(this, _isString(input) ? Self.parseUrl(input) : Url.copy(input));
	}

	/**
	 * Converts the instance to string.
	 *
	 * @return string
	 */
	toString() {
        return this.href;
    }
    
	/**
	 * Creates an instance from parsing an URL string
     * or from a regular object.
	 *
	 * @param string|object 	href
	 *
	 * @return Url
	 */
	static from(href) {
        return new this(_isObject(href) ? href : this.parseUrl(href));
	}

	/**
	 * Copies URL properties off
	 * the given object.
	 *
	 * @param object 			urlObj
	 *
	 * @return object
	 */
	static copy(urlObj) {
		var url = urlProperties.reduce((obj, prop) => _with(obj, prop, urlObj[prop]), {});
		if (!('query' in urlObj)) {
			delete url.query;
		}
		return url;
	}

	/**
	 * Parses an URL and returns its properties
	 *
	 * @param string			href
	 *
	 * @return object
	 */
	static parseUrl(href) {
		var a = document.createElement('a');
		a.href = href;
		return this.copy(a);
	}

	/**
	 * Parses the input search string into a named map
	 *
	 * @param string			search
	 *
	 * @return object
	 */
	static toQuery(search) {
		return params.parse(search);
	}

	/**
	 * Stringifies the input query to search string.
	 *
	 * @param object			query
	 *
	 * @return string
	 */
	static toSearch(query) {
		var search = params.stringify(query);
		return search ? '?' + search : '';
	}}

/**
 * These are standard
 * and shouldnt'/can't be modified
 *
 * @array
 */
const urlProperties = [
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
];