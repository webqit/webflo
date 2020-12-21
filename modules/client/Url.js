
/**
 * @imports
 */
import Observer from '@webqit/observer';
import _sort from '@webqit/util/arr/sort.js';
import _difference from '@webqit/util/arr/difference.js';
import _isArray from '@webqit/util/js/isArray.js';
import _isObject from '@webqit/util/js/isObject.js';
import _isTypeObject from '@webqit/util/js/isTypeObject.js';
import _isString from '@webqit/util/js/isString.js';
import _isEmpty from '@webqit/util/js/isEmpty.js';
import _copy from '@webqit/util/obj/copy.js';
import _with from '@webqit/util/obj/with.js';

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
	constructor(input, pathMappingScheme = {}) {
        const Self = this.constructor;
        this.pathMappingScheme = pathMappingScheme;
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
		// -----------------------
		// Setting the "href" properties must also publish
		// all the other properties in urlProperties
		Observer.intercept(this, 'set', (e, recieved, next) => {
			if (e.query === 'href' && _difference(urlProperties, e.related).length) {
				var urlObj = Self.parseUrl(e.value);
				Observer.set(this, urlObj);
				return false;
			}
			return next();
		});
		// -----------------------
		// When any one of these properties change,
		// the others are automatically derived
		Observer.observe(this, [['search'], ['searchmap'], ['pathname'], ['pathmap'], ['pathsplit'], ['href']], changes => {
			var [search, searchmap, pathname, pathmap, pathsplit, href] = changes.map(delta => delta.value);
			var [_search, _searchmap, _pathname, _pathmap, _pathsplit, _href] = changes.map(delta => delta.oldValue);
			if (changes[1]/*searchmap*/.type === 'set' && !changes[1]/*searchmap*/.isUpdate) {
				return;
			}
			var urlObj = {};
			// ----------
			var isSearchmapSame = changes[1]/*searchmap*/.type === 'get' && _strictEven(searchmap, _searchmap);
			if (search === _search && !isSearchmapSame) {
				// "searchmap" was updated. So we update "search"
				urlObj.search = Self.toSearch(searchmap);
				if (urlObj.search === this.search) {
					delete urlObj.search;
				}
			}
			if (search !== _search && isSearchmapSame) {
				// "search" was updated. So we update "searchmap"
				urlObj.searchmap = Self.toSearchmap(search);
				if (_strictEven(urlObj.searchmap, this.searchmap)) {
					delete urlObj.searchmap;
				}
			}
			// ----------
			var isPathmapSame = changes[3]/*pathmap*/.type === 'get' && _strictEven(pathmap, _pathmap);
			var isPathsplitSame = changes[4]/*pathsplit*/.type === 'get' && _strictEven(pathsplit, _pathsplit);
			if (pathname === _pathname && (!isPathmapSame || !isPathsplitSame)) {
				// We update "pathname" from the new "pathmap"/"pathsplit"
				urlObj.pathname = Self.toPathname(!isPathsplitSame ? pathsplit : pathmap, this.pathname/*referenceUrl*/, this.pathMappingScheme/*pathMappingScheme*/);
				if (urlObj.pathname === this.pathname) {
					delete urlObj.pathname;
				}
			}
			if (isPathmapSame && (pathname !== _pathname || !isPathsplitSame)) {
				// We update "pathmap" from the new "pathname"/"pathsplit"
				urlObj.pathmap = Self.toPathmap(pathname !== _pathname ? pathname : pathsplit, this.pathMappingScheme/*pathMappingScheme*/);
				if (_strictEven(urlObj.pathmap, this.pathmap)) {
					delete urlObj.pathmap;
				}
			}
			if (isPathsplitSame && (pathname !== _pathname || !isPathmapSame)) {
				// We update "pathsplit" from the new "pathname"/"pathmap"
				urlObj.pathsplit = Self.toPathsplit(pathname !== _pathname ? pathname : pathmap, this.pathname/*referenceUrl*/, this.pathMappingScheme/*pathMappingScheme*/);
				if (_strictEven(urlObj.pathsplit, this.pathsplit)) {
					delete urlObj.pathsplit;
				}
			}
			// ----------
			if (href === _href && !_isEmpty(urlObj)) {
				// We update "href" from the new component values
				urlObj.href = this.origin;
				urlObj.href += urlObj.pathname/*if pathmap or pathsplit was the change*/ || pathname/*whether or not pathname was the change*/;
				urlObj.href += urlObj.search/*if searchmap was the change*/ || search/*whether or not search was the change*/ || '';
				if (urlObj.href === this.href) {
					delete urlObj.href;
				}
			} else if (_isEmpty(urlObj) && href !== _href) {
				// We update component values from the new "href"
				urlObj = Self.parseUrl(href);
			}
			if (!_isEmpty(urlObj)) {
				return Observer.set(this, urlObj);
			}
		}, {subtree:true/*for pathmap/pathsplit/searchmap updates*/, diff: true});
		// -----------------------
		// Validate e.details
		Observer.observe(this, changes => {
			changes.forEach(delta => {
				if (delta && delta.detail) {
					if (!_isTypeObject(delta.detail)) {
						throw new Error('"e.detail" can only be of type object.');
					}
					if (delta.detail.request && !_isObject(delta.detail.request)) {
						throw new Error('"e.detail.request" can only be of type object.');
					}
				}
			});
		}, {diff: true});
		// -----------------------
		// Startup properties
        Observer.set(this, Url.copy(input));
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
	 * @param object 	        pathMappingScheme
	 *
	 * @return Url
	 */
	static from(href, pathMappingScheme = {}) {
        return new this(_isObject(href) ? href : this.parseUrl(href), pathMappingScheme);
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
		return _copy(urlObj, urlProperties, false/*withSymbols*/);
	}

	/**
	 * Parses an URL and returns its properties
	 *
	 * @param string			href
	 *
	 * @return object
	 */
	static parseUrl(href) {
		var a = window.document.createElement('a');
		a.href = href;
		return urlProperties.reduce((obj, prop) => _with(obj, prop, a[prop]), {});
	}

	/**
	 * Parses the input search string into a named map
	 *
	 * @param string			search
	 *
	 * @return object
	 */
	static toSearchmap(search) {
		var queryArr = (search.startsWith('?') ? search.substr(1) : search)
			.split('&').filter(str => str).map(str => str.split('=').map(str => str.trim()));
		return queryArr.reduce((recieved, q) => _with(recieved, q[0], q[1]), {});
	}

	/**
	 * Stringifies the input searchmap to search string.
	 *
	 * @param object			searchmap
	 *
	 * @return string
	 */
	static toSearch(searchmap) {
		return Object.keys(searchmap).length 
			? '?' + Object.keys(searchmap).map(k => k + '=' + searchmap[k]).join('&')
			: '';
	}

	/**
	 * Parses the input path and returns its parts named
	 *
	 * @param string|array			pathnameOrPathsplit
	 * @param object    			pathMappingScheme
	 *
	 * @return object
	 */
	static toPathmap(pathnameOrPathsplit, pathMappingScheme = {}) {
		var pathArr = _isString(pathnameOrPathsplit) ? pathnameOrPathsplit.split('/').filter(k => k) : pathnameOrPathsplit;
		var pathStr = _isString(pathnameOrPathsplit) ? pathnameOrPathsplit : '/' + pathArr.join('/') + '/';
		var pathMappingScheme = _sort(Object.keys(pathMappingScheme), 'desc').reduce((_pathnames, _path) => {
			return _pathnames || ((pathStr + '/').startsWith(_path === '/' ? _path : '/' + _path.split('/').filter(k => k).join('/') + '/') ? pathMappingScheme[_path] : null);
		}, null);
		return !pathMappingScheme ? {} : pathArr.reduce((obj, pathItem, i) => pathMappingScheme[i] ? _with(obj, pathMappingScheme[i], pathItem) : obj, {});
	}

	/**
	 * Parses the input path and returns its parts unnamed
	 *
	 * @param string|object			pathnameOrPathmap
	 * @param string				referenceUrl
	 * @param object    			pathMappingScheme
	 *
	 * @return array
	 */
	static toPathsplit(pathnameOrPathmap, referenceUrl = null, pathMappingScheme = {}) {
		if (_isString(pathnameOrPathmap)) {
			return pathnameOrPathmap.split('/').filter(k => k);
		}
		if (!referenceUrl) {
			throw new Error('A "referenceUrl" must be given to properly determine a path-naming scheme.');
		}
		var pathMappingScheme = _sort(Object.keys(pathMappingScheme), 'desc').reduce((_pathnames, _path) => {
			return _pathnames || ((referenceUrl + '/').startsWith(_path === '/' ? _path : '/' + _path.split('/').filter(k => k).join('/') + '/') ? pathMappingScheme[_path] : null);
		}, null);
		if (_difference(Object.keys(pathnameOrPathmap), pathMappingScheme).length) {
			throw new Error('The given pathmap contains keys (' + Object.keys(pathnameOrPathmap).join(', ') + ') not recognized by the implied path-naming scheme (' + pathMappingScheme.join(', ') + ')');
		}
		return !pathMappingScheme ? [] : pathMappingScheme.map(name => pathnameOrPathmap[name]).filter(a => a);
	}

	/**
	 * Stringifies the input pathmap or pathsplit to a string
	 *
	 * @param object|array			pathmapOrPathsplit
	 * @param string				referenceUrl
     * @param object                pathMappingScheme
	 *
	 * @return string
	 */
	static toPathname(pathmapOrPathsplit, referenceUrl = null, pathMappingScheme = {}) {
		if (_isObject(pathmapOrPathsplit)) {
			if (!referenceUrl) {
				throw new Error('A "referenceUrl" must be given to properly determine a path-naming scheme.');
			}
			pathmapOrPathsplit = Self.toPathsplit(pathmapOrPathsplit, referenceUrl, pathMappingScheme);
		}
		return '/' + pathmapOrPathsplit.join('/') + '/';
	}
};

/**
 * These are standard
 * and shouldnt'/can't be modified
 *
 * @array
 */
const urlProperties = [
	'hash',
	'host',
	'hostname',
	'href',
	'origin',
	'pathname',
	'port',
	'protocol',
	'search',
];