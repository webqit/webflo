
/**
 * imports
 */
import Url from 'url';
import Http from 'http';
import Cookie from 'cookie';
import Chalk from 'chalk';
import Formidable from 'formidable';
import _isArray from '@onephrase/util/js/isArray.js';
import _isObject from '@onephrase/util/js/isObject.js';
import _promise from '@onephrase/util/js/promise.js';
import _beforeLast from '@onephrase/util/str/beforeLast.js';
import _wrapped from '@onephrase/util/str/wrapped.js';
import _each from '@onephrase/util/obj/each.js';
import _set from '@onephrase/util/obj/set.js';
import createBrowser from './createBrowser.js';
import Router from './Router.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    if (params.showRequestLog) {
        console.log(Chalk.whiteBright('Request log:'));
        console.log('');
    }

    // -------------------
    // Create server
    // -------------------

    const router = new Router(params);
    const route = async (request, response) => {

        try {
            // Makes a global window available, even for route handlers
            // But will throw on static serve mode where an actual HTML file is not
            // in params
            var { document, jsdomInstance } = await createBrowser(params, request);
        } catch(e) {}
        var data = await router.route(request, response);
        
        if (_isObject(data) && !data.contentType) {
            
            // Rendering setup
            return await _promise(resolve => {

                (new Promise(resolve => {
                    if (document.templatesReadyState === 'complete') {
                        resolve();
                    } else {
                        document.addEventListener('templatesreadystatechange', resolve);
                    }
                })).then(async () => {
                    var requestPath = request.url.split('?')[0];
                    document.body.setAttribute('template', (params.templateRoutePath || 'app') + (requestPath));
                    document.bind(data, {update: true});
                    // Allow common async tasks to complete
                    setTimeout(() => {
                        resolve({
                            contentType: 'text/html',
                            content: jsdomInstance.serialize(),
                        });
                    }, params.renderDuration || 1000);
                });
                
            });
        }

        return data;
    };

    // -------------------
    // Create server
    // -------------------

    Http.createServer(async function (request, response) {

        // --------
        // Request parsing
        // --------

        const setToPath = (target, name, value, indexes) => {
            if (name.endsWith('[]')) {
                if (!indexes[name]) {
                    indexes[name] = 0;
                }
                name = _beforeLast(name, '[]') + '[' + (indexes[name] ++) + ']';
            }
            var pathArray = name.split('[').map(seg => _beforeLast(seg, ']'));
            _set(target, pathArray, value);
        };

        // Query
        request.query = {}; var queryIndexes = {};
        _each(Url.parse(request.url, true, true).query, (name, value) => {
            var _name = name.endsWith('[]') && _isArray(value) ? _beforeLast(name, '[]') : name;
            var _value = typeof value === 'string' && (_wrapped(value, '{', '}') || _wrapped(value, '[', ']')) ? JSON.parse(value) : value;
            setToPath(request.query, _name, _value, queryIndexes);
        });

        // Cookies
        request.cookies = {}; var cookiesIndexes = {};
        _each(Cookie.parse(request.headers.cookie || ''), (name, value) => {
            var _value = _wrapped(value, '{', '}') || _wrapped(value, '[', ']') ? JSON.parse(value) : value;
            setToPath(request.cookies, name, _value, cookiesIndexes);
        });

        // Inputs
        request.inputs = () => request.body().then(body => body.inputs);

        // Files
        request.files = () => request.body().then(body => body.files);

        // Body
        request.body = () => {
            var formidable, contentType = request.headers['content-type'], body = {
                inputs: {},
                files: {},
                type: contentType === 'application/x-www-form-urlencoded' ? 'form' 
                    : (contentType === 'application/json' ? 'json' : (contentType.startsWith('multipart/') ? 'multipart' : contentType)),
            };
            return new Promise((resolve, reject) => {
                if (!formidable) {
                    formidable = new Formidable.IncomingForm({multiples: true});
                    formidable.parse(request, function(error, inputs, files) {
                        if (error) {
                            reject(error);
                            return;
                        }
                        var inputsIndexes = {};
                        Object.keys(inputs).forEach(name => {
                            var _name = name; // name.endsWith('[]') && _isArray(inputs[name]/* not _value */) ? _beforeLast(name, '[]') : name;
                            var _value = inputs[name]; // typeof inputs[name] === 'string' && (_wrapped(inputs[name], '{', '}') || _wrapped(inputs[name], '[', ']')) ? JSON.parse(inputs[name]) : inputs[name];
                            setToPath(body.inputs, _name, _value, inputsIndexes);
                        });
                        var filesIndexes = {};
                        Object.keys(files).forEach(name => {
                            var _name = name.endsWith('[]') && _isArray(files[name]) ? _beforeLast(name, '[]') : name;
                            setToPath(body.files, _name, files[name], filesIndexes);
                        });
                        resolve(body);
                    });
                } else {
                    resolve(body);
                }
            });
        };

        // --------
        // Request handling
        // --------

        var fatal, data;
        try {
            data = await route(request, response);
            if (!response.headersSent) {
                if (data) {
                    response.setHeader('Content-type', data.contentType);
                    if (data.cors) {
                        response.setHeader('Access-Control-Allow-Origin', data.cors === true ? '*' : data.cors);
                    }
                    response.end(
                        data.contentType === 'application/json' && _isObject(data.content) 
                            ? JSON.stringify(data.content) 
                            : data.content
                    );    
                } else {
                    /*var requestPath = request.url.split('?')[0];
                    if (requestPath.lastIndexOf('.') < requestPath.lastIndexOf('/')) {
                        response.statusCode = 500;
                        response.end(`Internal server error!`);
                    } else*/ {
                        response.statusCode = 404;
                        response.end(`${request.url} not found!`);
                    }
                }
            }
        } catch(e) {
            fatal = e;
            response.statusCode = e.errorCode || 500;
            response.end(`Internal server error!`);
        }

        // --------
        // Request log
        // --------

        if (params.showRequestLog) {
            console.log(''
                + '[' + Chalk.gray((new Date).toUTCString()) + '] '
                + Chalk.green(request.method) + ' '
                + request.url + (data && data.autoIndex ? Chalk.gray((!request.url.endsWith('/') ? '/' : '') + data.autoIndex) : '') + ' '
                + (data ? ' (' + data.contentType + ') ' : '')
                + (
                    [404, 500].includes(response.statusCode) 
                    ? Chalk.redBright(response.statusCode + (fatal ? ` [ERROR]: ${fatal.error || fatal.toString()}` : ``)) 
                    : Chalk.green(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + response.getHeader('location') : '')
                )
            );
        }

        if (fatal) {
            process.exit();
        }

    }).listen(parseInt(params.port));

};
