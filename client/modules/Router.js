
/**
 * @imports
 */
import _isString from '@onephrase/util/js/isString.js';
import Url from './Url.js';

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
	 * @param object	routeTree
	 *
	 * @return void
	 */
	constructor(routeTree = {}) {
        this.routeTree = routeTree;
    }
    
	/**
	 * Performs dynamic routing.
	 *
	 * @param object				request
	 *
	 * @return void
	 */
	async route(request) {
        var routeTree = this.routeTree;
        // ----------------
        // The loop
        // ----------------
        var pathSplit = request.url.pathname.split('/').filter(a => a);
        const next = async function(index, recieved) {
            var currentHandler;
            if (index === 0) {
                currentHandler = routeTree['/'];
            } else if (pathSplit[index - 1]) {
                var currentHandlerPath = '/' + pathSplit.slice(0, index).join('/');
                currentHandler = routeTree[currentHandlerPath];
            }
            if (currentHandler) {
                // -------------
                // Dynamic response
                // -------------
                var _next = (...args) => next(index + 1, ...args);
                _next.path = pathSplit.slice(index).join('/');
                return await currentHandler(request, recieved, _next);
            }
            if (arguments.length === 1) {
                // -------------
                // Remote request
                // -------------
                return window.fetch(request.url.toString(), request.headers);
            }
            // -------------
            // Recieved response or undefined
            // -------------
            return recieved;
        };
        return next(0);
    } 
};
