
/**
 * @imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import _isString from '@webqit/util/js/isString.js';
import _isArray from '@webqit/util/js/isArray.js';
import _arrFrom from '@webqit/util/arr/from.js';

export default class Router {

    /**
     * Instantiates a new Router.
     * 
     * @param string|array      path
     * @param object            layout
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
        var layout = this.layout;
        var context = this.context;

        // ----------------
        // ROUTER
        // ----------------
        const next = async function(index, input, path) {
    
            var exports, routeHandlerFile, wildcardRouteHandlerFile;
            if (index === 0) {
                routeHandlerFile = 'index.js';
            } else if (path[index - 1]) {
                var routeSlice = path.slice(0, index).join('/');
                var wildcardRouteSlice = path.slice(0, index - 1).concat('*').join('/');
                routeHandlerFile = Path.join(routeSlice, './index.js');
                wildcardRouteHandlerFile = Path.join(wildcardRouteSlice, './index.js');
            }
    
            if ((routeHandlerFile && Fs.existsSync(routeHandlerFile = Path.join(layout.ROOT, layout.SERVER_DIR, routeHandlerFile)))
            || (wildcardRouteHandlerFile && Fs.existsSync(routeHandlerFile = Path.join(layout.ROOT, layout.SERVER_DIR, wildcardRouteHandlerFile)))) {
                exports = await import(Url.pathToFileURL(routeHandlerFile));
                // ---------------
                const func = target.reduce((func, name) => func || exports[name], null);
                if (func) {
                    // -------------
                    // Then we can call the handler
                    // -------------
                    const _next = (..._args) => {
                        if (_args.length > 1) {
                            if (!_isString(_args[1])) {
                                throw new Error('Router redirect must be a string!');
                            }
                            if (_args[1].startsWith('/')) {
                                throw new Error('Router redirect must NOT be an absolute path!');
                            }
                            _args[1] = path.slice(0, index).concat(_args[1].split('/').map(a => a.trim()).filter(a => a));
                        } else {
                            _args[1] = path;
                        }
                        return next(index + 1, ..._args);
                    };
                    _next.pathname = path.slice(index).join('/');
                    // -------------
                    const _this = {
                        pathname: '/' + path.slice(0, index).join('/'),
                        dirname: Path.dirname(routeHandlerFile),
                        ...context
                    };
                     // -------------
                    return await func.bind(_this)(...argsA.concat([input, _next/*next*/].concat(argsB)));
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

    /**
     * Reads a static file from the public directory.
     * 
     * @param object filename
     * 
     * @return Promise
     */
    fetch(filename) {
        var _filename = Path.join(this.layout.ROOT, this.layout.PUBLIC_DIR, filename);
        var autoIndex;
        if (Fs.existsSync(_filename)) {
            // based on the URL path, extract the file extention. e.g. .js, .doc, ...
            var ext = Path.parse(filename).ext;
            // read file from file system
            return new Promise((resolve, reject) => {
                // if is a directory search for index file matching the extention
                if (!ext && Fs.lstatSync(_filename).isDirectory()) {
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
                        resolve(new FixedResponse(ext === '.json' ? data + '' : data, mimeTypes[ext] || 'text/plain', _filename, autoIndex));
                    }
                });
            });
        }
    }

    /**
     * Writes a file to the public directory.
     * 
     * @param object filename
     * @param string content
     * 
     * @return bool
     */
    putPreRendered(filename, content) {
        var _filename = Path.join(this.layout.PUBLIC_DIR, '.', filename);
        if (!Path.parse(filename).ext && filename.lastIndexOf('.') < filename.lastIndexOf('/')) {
            _filename = Path.join(_filename, '/index.html');
        }
        var dir = Path.dirname(_filename);
        if (!Fs.existsSync(dir)) {
            Fs.mkdirSync(dir, {recursive:true});
        }
        return Fs.writeFileSync(_filename, content);
    }

    /**
     * Deletes a file from the public directory.
     * 
     * @param object filename
     * 
     * @return bool
     */
    deletePreRendered(filename) {
        return Fs.unlinkSync(filename);
    }
};

// maps file extention to MIME typere
const mimeTypes = {
    '.ico':     'image/x-icon',
    '.html':    'text/html',
    '.js':      'text/javascript',
    '.json':    'application/json',
    '.css':     'text/css',
    '.png':     'image/png',
    '.jpg':     'image/jpeg',
    '.wav':     'audio/wav',
    '.mp3':     'audio/mpeg',
    '.svg':     'image/svg+xml',
    '.pdf':     'application/pdf',
    '.doc':     'application/msword'
};

export { mimeTypes };

// Static response
export class FixedResponse {
    // construct
    constructor(content, contentType, filename, autoIndex) {
        this.content = content;
        this.contentType = contentType;
        this.filename = filename;
        this.autoIndex = autoIndex;
        this.static = true;
    }
};