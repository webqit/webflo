
/**
 * @imports
 */
import _isString from '@webqit/util/js/isString.js';
import _isFunction from '@webqit/util/js/isFunction.js';
import _isArray from '@webqit/util/js/isArray.js';
import _arrFrom from '@webqit/util/arr/from.js';

/**
 * ---------------------------
 * The Router class
 * ---------------------------
 */
			
export default class Router {

	/**
	 * Constructs a new Router instance
     * over route definitions.
	 *
	 * @param string|array	    path
	 * @param object	        params
	 *
	 * @return void
	 */
	constructor(path, params) {
        this.path = _isArray(path) ? path : (path + '').split('/').filter(a => a);
        this.params = params;
    }

    /**
     * Performs dynamic routing.
     * 
     * @param array|string      target
     * @param array             args
     * @param function          _default
     * 
     * @return object
     */
    async route(target, args, _default) {

        target = _arrFrom(target);
        var routeTree = this.params.ROUTES;

        // ----------------
        // The loop
        // ----------------
        const next = async function(path, index, output) {

            var exports;
            if (index === 0) {
                exports = routeTree['/'];
            } else if (path[index - 1]) {
                var currentHandlerPath = '/' + path.slice(0, index).join('/');
                var wildcardCurrentHandlerPath = path.slice(0, index - 1).concat('_').join('/');
                exports = routeTree[currentHandlerPath] || routeTree[wildcardCurrentHandlerPath];
            }

            if (exports) {
                var func = _isFunction(exports) && target.includes('default') ? exports : target.reduce((func, name) => func || exports[name], null);
                if (func) {
                    // -------------
                    // Dynamic response
                    // -------------
                    var _next = (..._args) => {
                        if (_args.length > 1) {
                            var rdr = _args.splice(1, 1)[0];
                            if (!_isString(rdr)) {
                                throw new Error('Router redirect must be a string!');
                            }
                            if (rdr.startsWith('/')) {
                                throw new Error('Router redirect must NOT be an absolute path!');
                            }
                            path = path.slice(0, index).concat(rdr.split('/').map(a => a.trim()).filter(a => a));
                        }
                        return next(path, index + 1, ..._args);
                    };
                    _next.pathname = path.slice(index).join('/');
                    // -------------
                    var _this = {};
                    _this.pathname = '/' + path.slice(0, index).join('/');
                    // -------------
                    return await func.bind(_this)(...args.concat([output, _next/*next*/]));
                }
            }

            if (_default) {
                // -------------
                // Local file
                // -------------
                var defaultThis = {pathname: '/' + path.join('/')};
                return await (arguments.length === 3 ? _default.call(defaultThis, output) : _default.call(defaultThis));
            }
    
            // -------------
            // Recieved response or undefined
            // -------------
            return output;
        };
        
        return next(this.path, 0);
    } 
};
