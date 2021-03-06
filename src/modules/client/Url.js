
/**
 * @imports
 */
import { Observer } from '@webqit/pseudo-browser/index2.js';
import _sort from '@webqit/util/arr/sort.js';
import _difference from '@webqit/util/arr/difference.js';
import _isArray from '@webqit/util/js/isArray.js';
import _isObject from '@webqit/util/js/isObject.js';
import _isTypeObject from '@webqit/util/js/isTypeObject.js';
import _isString from '@webqit/util/js/isString.js';
import _isEmpty from '@webqit/util/js/isEmpty.js';
import _copy from '@webqit/util/obj/copy.js';
import _with from '@webqit/util/obj/with.js';
import { wwwFormUnserialize, wwwFormSerialize } from '../util.js';

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
		// When any one of these properties change,
		// the others are automatically derived
		Observer.observe(this, changes => {
			var urlObj = {};
			var originChanged, hashChanged, hrefChanged, onlyHrefChanged;
			for (var e of changes) {
				if (e.name === 'query' && e.type === 'set' && !e.isUpdate) {
					// Abort completely
					return;
				}
				// ----------
				if (e.name === 'href' && e.related.length === 1) {
					var urlObj = Self.parseUrl(e.value);
					delete urlObj.href;
					onlyHrefChanged = true;
				}
				// ----------
				if (e.name === 'href') { hrefChanged = true; } else
				if (e.name === 'origin') { originChanged = true; } else
				if (e.name === 'hash') { hashChanged = true; }
				// ----------
				if ((e.name === 'pathmap' || e.name === 'pathsplit') && !e.related.includes('pathname')) {
					// We update "pathname" from the new "pathmap"/"pathsplit"
					var pathname = Self.toPathname(e.value, this.pathname/*referenceUrl*/, this.pathMappingScheme/*pathMappingScheme*/);
					if (pathname !== this.pathname) {
						urlObj.pathname = pathname;
					}
				}
				if ((e.name === 'pathname' || e.name === 'pathsplit') && !e.related.includes('pathmap')) {
					// We update "pathmap" from the new "pathname"/"pathsplit"
					var pathmap = Self.toPathmap(e.value, this.pathMappingScheme/*pathMappingScheme*/);
					if (!_strictEven(pathmap, this.pathmap)) {
						urlObj.pathmap = pathmap;
					}
				}
				if ((e.name === 'pathname' || e.name === 'pathmap') && !e.related.includes('pathsplit')) {
					// We update "pathsplit" from the new "pathname"/"pathmap"
					var pathsplit = Self.toPathsplit(e.value, this.pathname/*referenceUrl*/, this.pathMappingScheme/*pathMappingScheme*/);
					if (!_strictEven(pathsplit, this.pathsplit)) {
						urlObj.pathsplit = pathsplit;
					}
				}
				// ----------
				if (e.name === 'query' && !e.related.includes('search')) {
					// "query" was updated. So we update "search"
					var search = Self.toSearch(e.value);
					if (search !== this.search) {
						urlObj.search = search;
					}
				}
				if (e.name === 'search' && !e.related.includes('query')) {
					// "search" was updated. So we update "query"
					var query = Self.toQuery(e.value);
					if (!_strictEven(query, this.query)) {
						urlObj.query = query;
					}
				}
			}
			if (!onlyHrefChanged && (originChanged || hashChanged || urlObj.pathname || urlObj.search || urlObj.hash)) {
				var href = [urlObj.origin || this.origin, urlObj.pathname || this.pathname, urlObj.search || this.search, urlObj.hash || this.hash].join('');
				if (href !== this.href) {
					urlObj.href = href;
				}
			}
			if (!_isEmpty(urlObj)) {
				return Observer.set(this, urlObj);
			}
		}, {subtree:true/*for pathmap/pathsplit/query updates*/, diff: true});
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
		return urlProperties.reduce((obj, prop) => _with(obj, prop, urlObj[prop]), {});
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
		return wwwFormUnserialize(search);
	}

	/**
	 * Stringifies the input query to search string.
	 *
	 * @param object			query
	 *
	 * @return string
	 */
	static toSearch(query) {
		var search = wwwFormSerialize(query);
		return search ? '?' + search : '';
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
			pathmapOrPathsplit = this.toPathsplit(pathmapOrPathsplit, referenceUrl, pathMappingScheme);
		}
		return '/' + pathmapOrPathsplit.filter(a => a).join('/');
	}
}

/**
 * These are standard
 * and shouldnt'/can't be modified
 *
 * @array
 */
const urlProperties = [
	'host',
	'hostname',
	'href',
	'origin',
	'pathname',
	'port',
	'protocol',
	'search',
	'hash',
];