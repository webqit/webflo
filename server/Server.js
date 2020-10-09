
/**
 * imports
 */
import Url from 'url';
import Http from 'http';
import Path from 'path';
import Cookie from 'cookie';
import Accepts from 'accepts';
import Chalk from 'chalk';
import Minimatch from 'minimatch';
import Formidable from 'formidable';
import QueryString from 'querystring';
import _isArray from '@onephrase/util/js/isArray.js';
import _isFunction from '@onephrase/util/js/isFunction.js';
import _isObject from '@onephrase/util/js/isObject.js';
import _promise from '@onephrase/util/js/promise.js';
import _after from '@onephrase/util/str/after.js';
import _beforeLast from '@onephrase/util/str/beforeLast.js';
import _wrapped from '@onephrase/util/str/wrapped.js';
import _each from '@onephrase/util/obj/each.js';
import _set from '@onephrase/util/obj/set.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import Router, { FixedResponse } from './Router.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    console.log('');
    if (params.SHOW_REQUEST_LOG) {
        console.log(Chalk.whiteBright('Request log:'));
    }

    // --------
    // Directives
    // --------

    const vhosts = DotJson.read('vhosts.json');
    const redirects = DotJson.read('redirects.json');
    const preurls = DotJson.read('preurls.json');
    const matchPreurl = url => Object.keys(preurls).reduce((match, preurl) => match || Minimatch(url, preurl, {dot: true}) ? preurl : null, null);

    // -------------------
    // Create server
    // -------------------

    Http.createServer(async function (request, response) {

        params = {...params};
        const [ requestPathname, requestQuery ] = request.url.split('?');
        var data, fatal;

        // -------------------
        // Resolve canonicity
        // -------------------

        params.HOST_PATH = vhosts[request.headers.host] ? '/' +  vhosts[request.headers.host].split('/').filter(seg => seg).join('/') : '';

        // -------------------
        // Resolve redirects
        // -------------------

        var resolvedRequestPathname = params.HOST_PATH + requestPathname;
        var rdr = Object.keys(redirects).reduce((match, pattern) => {

            if (match) {
                return match;
            }
            var matcher = Minimatch.Minimatch(pattern, {dot: true});
            var regex = matcher.makeRe();
            var _leastMatch = resolvedRequestPathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
            if (_leastMatch.endsWith(' ')) {
                _leastMatch = _leastMatch.trim();
                var _afterMatch = _after(resolvedRequestPathname, _leastMatch);
                var [ _rdr, _rdrCode ] = redirects[pattern].split(' ').map(str => str.trim());
                var [ _rdrPath, _rdrQuery ] = _rdr.split('?');
                // ---------------
                return {
                    path: _rdrPath + _afterMatch,
                    query: [requestQuery, _rdrQuery].filter(str => str).join('&'),
                    code: _rdrCode || 302,
                };
            }

        }, null);

        if (rdr) {

            // if rdr falls within another virtual host, use the hostname
            rdr.resolvedPath = Object.keys(vhosts).reduce((match, host) => match || ((rdr.path + '/').startsWith(vhosts[host] + '/') ? '//' + host + _after(rdr.path, vhosts[host]) : null), null);
            // If rdr does not resolve to a virtual host and current request is from a virtual host,
            // prevent rdr from resolving to the current request's host name
            if (!rdr.resolvedPath && params.HOST_PATH) {
                rdr.resolvedPath = '//' + params.HOST + ':' + params.PORT + rdr.path;
            } else {
                rdr.resolvedPath = rdr.path;
            }
            response.statusCode = rdr.code;
            response.setHeader('Location', rdr.resolvedPath);
            response.end();

        } else {

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

            // Accept Headers
            request.accepts = Accepts(request);

            // The app router
            const router = new Router(requestPathname, params);

            // The service object
            const service = {
                params,
                // Request
                request,
                // Response
                response,
                // Piping utility
                pipe: async (...stack) => {
                    var val;
                    var pipe = async function() {
                        var middleware = stack.shift();
                        if (middleware) {
                            val = await middleware(request, response, pipe);
                            return val;
                        }
                    };
                    await pipe();
                    return val;
                },
            };

            // --------
            // service.request handling
            // --------

            try {

                // --------
                // ROUTE FOR DATA
                // --------
                data = await router.route([service], [service.request.method.toLowerCase(), 'default'], async function(output) {
                    if (arguments.length) {
                        return output;
                    }
                    var file = await router.fetch(params.HOST_PATH + service.request.url);
                    // JSON request should ignore static files
                    if (file && !service.request.accepts.type(file.contentType)) {
                        return;
                    }
                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                        if (!matchPreurl(resolvedRequestPathname)) {
                            router.deletePreRendered(file.filename);
                            return;
                        }
                    }
                    return file;
                });
                // --------
                // ROUTE FOR RENDERING?
                // --------
                if (!(data instanceof FixedResponse) && _isObject(data)) {
                    if (service.request.accepts.type('text/html')) {
                        // --------
                        // Render
                        // --------
                        const window = await router.route([data], 'render', async function(_window) {
                            if (arguments.length) {
                                return _window;
                            }
                            // --------
                            const instanceParams = QueryString.stringify({
                                source: Path.join(params.PUBLIC_DIR, './index.html'),
                                host: params.SUB_RESOURCE_HOST || service.request.headers['host'],
                                uri: params.HOST_PATH + service.request.url,
                                g: 'globalServersideWindow' in params ? params.GLOBAL_SSR_WINDOW : 0,
                            });
                            const { window } = await import('@web-native-js/browser-pie/instance.js?' + instanceParams);
                            // --------
                            window.document.bind(data, {update: Object.keys(window.document.bindings).length !== 0});
                            window.document.body.setAttribute('template', 'app' + requestPathname);
                            return window;
                        });
                        // --------
                        // Serialize rendering?
                        // --------
                        if (_isObject(window) && window.document && window.print) {
                            data = await _promise(resolve => {
                                (new Promise(resolve => {
                                    if (window.document.templatesReadyState === 'complete') {
                                        resolve();
                                    } else {
                                        window.document.addEventListener('templatesreadystatechange', resolve);
                                    }
                                })).then(async () => {
                                    // Allow common async tasks to complete
                                    setTimeout(() => {
                                        resolve({
                                            contentType: 'text/html',
                                            content: window.print(),
                                        });
                                    }, params.RENDER_DURATION || 1000);
                                });
                            });
                        } else {
                            data = window;
                        }
                    } else if (service.request.accepts.type('application/json')) {
                        // --------
                        // JSONfy
                        // --------
                        data = {
                            contentType: 'application/json',
                            content: data,
                        }
                    }
                }

                // --------
                // SEND RESPONSE
                // --------

                if (!service.response.headersSent) {
                    if (data) {
                        service.response.setHeader('Content-type', data.contentType);
                        if (data.cors) {
                            service.response.setHeader('Access-Control-Allow-Origin', data.cors === true ? '*' : data.cors);
                        }
                        service.response.end(
                            data.contentType === 'application/json' && _isObject(data.content) 
                                ? JSON.stringify(data.content) 
                                : data.content
                        );
                        // ----------------
                        // PRE-RENDERING
                        // ----------------
                        if (!data.filename && data.contentType === 'text/html') {
                            var prerenderMatch = matchPreurl(resolvedRequestPathname);
                            if (prerenderMatch) {
                                router.putPreRendered(resolvedRequestPathname, `<!-- PRE-RENDERED -->\r\n` + data.content);
                            }
                        }
                    } else {
                        service.response.statusCode = 404;
                        service.response.end(`${service.request.url} not found!`);
                    }
                }

            } catch(e) {

                fatal = e;
                service.response.statusCode = e.errorCode || 500;
                service.response.end(`Internal server error!`);

            }

        }

        // --------
        // service.request log
        // --------

        if (params.SHOW_REQUEST_LOG) {
            console.log(''
                + '[' + Chalk.gray((new Date).toUTCString()) + '] '
                + Chalk.green(request.method) + ' '
                + (params.HOST_PATH || '') + request.url + (data && data.autoIndex ? Chalk.gray((!request.url.endsWith('/') ? '/' : '') + data.autoIndex) : '') + ' '
                + (data ? ' (' + data.contentType + ') ' : '')
                + (
                    [404, 500].includes(response.statusCode) 
                    ? Chalk.redBright(response.statusCode + (fatal ? ` [ERROR]: ${fatal.error || fatal.toString()}` : ``)) 
                    : Chalk.green(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + response.getHeader('location') : '')
                )
            );
        }

        if (fatal) {
            throw fatal;
        }

    }).listen(parseInt(params.P || params.PORT));

};
