
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import _isString from '@web-native-js/commons/js/isString.js';

export default class Router {

    /**
     * Instantiates a new Router.
     * 
     * @param object            params
     * 
     * @return void
     */
    constructor(params) {
        this.params = params;
        this.middlewareStacks = {};
    }

    /**
     * Performs dynamic routing.
     * 
     * @param object            request
     * @param object            response
     * 
     * @return object
     */
    async route(request, response) {

        var params = this.params;
        var localFetch = this.fetch.bind(this);
        // ----------------
        // ROUTER
        // ----------------
        var pathSplit = request.url.split('?')[0].split('/').filter(a => a);

        const next = async function(index, recieved) {

            var routeHandlerFile;
            if (index === 0) {
                routeHandlerFile = 'index.js';
            } else if (pathSplit[index - 1]) {
                var routeSlice = pathSplit.slice(0, index).join('/');
                routeHandlerFile = Path.join(routeSlice, './index.js');
            }

            if (routeHandlerFile && Fs.existsSync(routeHandlerFile = Path.join(params.appDir, routeHandlerFile))) {
                var pathHandlers = await import('file:///' + routeHandlerFile);
                var middlewareStack = (pathHandlers.middlewares || []).slice();
                var pipe = async function() {
                    // -------------
                    // Until we call the last middleware
                    // -------------
                    var middleware = middlewareStack.shift();
                    if (middleware) {
                        return await middleware(request, response, pipe);
                    }
                };
                await pipe();

                // -------------
                // Then we can call the handler
                // -------------
                var _next = (...args) => next(index + 1, ...args); _next.path = pathSplit.slice(index).join('/');
                return await pathHandlers.default(request, recieved, _next/*next*/);
            }

            if (arguments.length === 1) {
                // -------------
                // Local file
                // -------------
                return await localFetch(request.url, request);
            }

            // -------------
            // Recieved response or undefined
            // -------------
            return recieved;
        };

        return next(0);
    }

    /**
     * Performs dynamic routing.
     * 
     * @param object filename
     * @param object options
     * 
     * @return Promise
     */
    async fetch(filename, options) {
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
                        resolve(new StaticResponse(data, mimeTypes[ext] || 'text/plain', autoIndex));
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
export class StaticResponse {
    // construct
    constructor(content, contentType, autoIndex) {
        this.content = content;
        this.contentType = contentType;
        this.autoIndex = autoIndex;
        this.static = true;
    }
};