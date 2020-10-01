
/**
 * @imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import _isString from '@onephrase/util/js/isString.js';
import _isArray from '@onephrase/util/js/isArray.js';
import _arrFrom from '@onephrase/util/arr/from.js';

export default class Router {

    /**
     * Instantiates a new Router.
     * 
     * @param string|array      path
     * @param object            params
     * 
     * @return void
     */
    constructor(path, params) {
        this.offsetUrl = _isArray(params.offsetUrl) ? params.offsetUrl : ((params.offsetUrl || '') + '').split('/').filter(a => a);
        this.clientPath = _isArray(path) ? path : (path + '').split('/').filter(a => a);
        this.path = this.offsetUrl.concat(this.clientPath);
        this.params = params;
    }

    /**
     * Performs dynamic routing.
     * 
     * @param array             args
     * @param array|string      target
     * @param function          _default
     * 
     * @return object
     */
    async route(args, target, _default) {
        
        target = _arrFrom(target);
        var path = this.path;
        var clientPath = this.clientPath;
        var params = this.params;

        // ----------------
        // ROUTER
        // ----------------
        const next = async function(index, output) {
    
            var exports, routeHandlerFile, wildcardRouteHandlerFile;
            if (index === 0) {
                routeHandlerFile = 'index.js';
            } else if (path[index - 1]) {
                var routeSlice = path.slice(0, index).join('/');
                var wildcardRouteSlice = path.slice(0, index - 1).concat('_').join('/');
                routeHandlerFile = Path.join(routeSlice, './index.js');
                wildcardRouteHandlerFile = Path.join(wildcardRouteSlice, './index.js');
            }
    
            if ((routeHandlerFile && Fs.existsSync(routeHandlerFile = Path.join(params.appDir, routeHandlerFile)))
            || (wildcardRouteHandlerFile && Fs.existsSync(routeHandlerFile = Path.join(params.appDir, wildcardRouteHandlerFile)))) {
                exports = await import(Url.pathToFileURL(routeHandlerFile));
                // ---------------
                var func = target.reduce((func, name) => func || exports[name], null);
                if (func) {
                    // -------------
                    // Then we can call the handler
                    // -------------
                    var _next = (..._args) => next(index + 1, ..._args);
                    _next.pathname = path.slice(index).join('/');
                    _next.clientPathname = clientPath.slice(index).join('/');
                    // -------------
                    var _this = {};
                    _this.pathname = '/' + path.slice(0, index).join('/');
                    _this.clientPathname = '/' + clientPath.slice(0, index).join('/');
                    // -------------
                    return await func.bind(_this)(...args.concat([output, _next/*next*/]));
                }
            }
    
            if (_default) {
                // -------------
                // Local file
                // -------------
                return await (arguments.length === 2 ? _default(output) : _default());
            }
    
            // -------------
            // Recieved response or undefined
            // -------------
            return output;
        };
    
        return next(0);
    }

    /**
     * Performs dynamic routing.
     * 
     * @param object filename
     * 
     * @return Promise
     */
    fetch(filename) {
        var _filename = Path.join(this.params.publicDir, '.', filename);
        var autoIndex;
        if (Fs.existsSync(_filename)) {
            // based on the URL path, extract the file extention. e.g. .js, .doc, ...
            var ext = Path.parse(filename).ext;
            // read file from file system
            return new Promise((resolve, reject) => {
                // if is a directory search for index file matching the extention
                if (!ext && filename.lastIndexOf('.') < filename.lastIndexOf('/')) {
                    ext = '.html';
                    _filename += '/index' + ext;
                    autoIndex = 'index.html';
                    if (!Fs.existsSync(_filename)) {
                        resolve();
                        return;
                    }
                }
                Fs.readFile(_filename, function(err, data){
                    if (err) {
                        // To be thrown by caller
                        reject({
                            errorCode: 500,
                            error: 'Error reading static file: ' + filename + '.',
                        });
                    } else {
                        // if the file is found, set Content-type and send data
                        resolve(new FixedResponse(data, mimeTypes[ext] || 'text/plain', autoIndex));
                    }
                });
            });
        }
    }
};

// maps file extention to MIME typere
const mimeTypes = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
};

export { mimeTypes };

// Static response
export class FixedResponse {
    // construct
    constructor(content, contentType, autoIndex) {
        this.content = content;
        this.contentType = contentType;
        this.autoIndex = autoIndex;
        this.static = true;
    }
};