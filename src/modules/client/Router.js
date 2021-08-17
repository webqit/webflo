
/**
 * @imports
 */
import _isString from '@webqit/util/js/isString.js';
import _isFunction from '@webqit/util/js/isFunction.js';
import _isArray from '@webqit/util/js/isArray.js';
import _arrFrom from '@webqit/util/arr/from.js';
import { path as Path } from '../util.js';

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
	 * @param object	        layout
     * @param object            context
	 *
	 * @return void
	 */
	constructor(path, layout, context) {
        this.path = _isArray(path) ? path : (path + '').split('/').filter(a => a);
        this.layout = layout;
        this.context = context;
    }

    /**
     * Performs dynamic routing.
     * 
     * @param array|string      target
     * @param array             argsA
     * @param any               input
     * @param function          _default
     * @param array             argsB
     * 
     * @return object
     */
     async route(target, argsA, input, _default, argsB = []) {

        target = _arrFrom(target);
        var routeTree = this.layout;
        var context = this.context;

        // ----------------
        // The loop
        // ----------------
        const next = async function(index, input, path) {

            var exports;
            if (index === 0) {
                exports = routeTree['/'];
            } else if (path[index - 1]) {
                var currentHandlerPath = '/' + path.slice(0, index).join('/');
                var wildcardCurrentHandlerPath = '/' + path.slice(0, index - 1).concat('-').join('/');
                exports = routeTree[currentHandlerPath] || routeTree[wildcardCurrentHandlerPath];
            }

            if (exports) {
                const func = _isFunction(exports) && target.includes('default') ? exports : target.reduce((func, name) => func || exports[name], null);
                if (func) {
                    // -------------
                    // Dynamic response
                    // -------------
                    const _next = (..._args) => {
                        var _index;
                        if (_args.length > 1) {
                            if (!_isString(_args[1])) {
                                throw new Error('Router redirect must be a string!');
                            }
                            var newPath = Path.join(path.slice(0, index).join('/'), _args[1]);
                            if (newPath.startsWith('../')) {
                                throw new Error('Router redirect cannot traverse beyond the routing directory! (' + _args[1] + ' >> ' + newPath + ')');
                            }
                            _args[1] = newPath.split('/').map(a => a.trim()).filter(a => a);
                            _index = path.slice(0, index).reduce((build, seg, i) => build.length === i && seg === _args[1][i] ? build.concat(seg) : build, []).length;
                        } else {
                            _args[1] = path;
                            _index = index;
                        }
                        return next(_index + 1, ..._args);
                    };
                    _next.pathname = path.slice(index).join('/');
                    _next.stepname = _next.pathname.split('/').shift();
                    // -------------
                    const _this = {
                        pathname: '/' + path.slice(0, index).join('/'),
                        ...context
                    };
                    _this.stepname = _this.pathname.split('/').pop();
                    // -------------
                    return await func.bind(_this)(...argsA.concat([input, _next/*next*/].concat(argsB)));
                } else {
                    return next(index + 1, input, path);
                }
            }

            if (_default) {
                // -------------
                // Local file
                // -------------
                const defaultThis = {pathname: '/' + path.join('/'), ...context};
                return await _default.call(defaultThis, input);
            }
    
            // -------------
            // Recieved response or undefined
            // -------------
            return;
        };
        
        return next(0, input, this.path);
    } 
};
