
/**
 * imports
 */
import Url from 'url';
import Http from 'http';
import Path from 'path';
import Cookie from 'cookie';
import Accepts from 'accepts';
import Formidable from 'formidable';
import QueryString from 'querystring';
import _set from '@webqit/util/obj/set.js';
import _each from '@webqit/util/obj/each.js';
import _isArray from '@webqit/util/js/isArray.js';
import _isObject from '@webqit/util/js/isObject.js';
import _promise from '@webqit/util/js/promise.js';
import _wrapped from '@webqit/util/str/wrapped.js';
import _beforeLast from '@webqit/util/str/beforeLast.js';
import { restart as serverRestart } from '../../cmd/server.js';
import Router, { FixedResponse } from './Router.js';
import * as prerendering from '../../config/prerendering.js';
import * as redirects from '../../config/redirects.js';
import * as repos from '../../cmd/repos.js';
import * as vhosts from '../../config/vhosts.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object $config
 * 
 * @return void
 */
export default function(Ui, config) {

    const modules = { prerendering, redirects, repos, vhosts, };
    const PORT = parseInt(config.P || config.PORT);
    const PROTOCOL = PORT === 443 ? 'https' : 'http';

    // -------------------
    // Create server
    // -------------------

    Http.createServer(async function (request, response) {

        const location = Url.parse(PROTOCOL + '://' + request.headers.host + request.url, true, true);
        const vhosts = (!modules.vhosts ? null : await modules.vhosts.match(location, config/* the root-level config */)) || [];
        const $config = {...config};
        var data, fatal;

        // -------------------
        // Resolve canonicity
        // -------------------

        if ($config.VHOSTS_MODE && vhosts.length) {
            $config.VHOST = vhosts[0];
            $config.ROOT = Path.join($config.ROOT, vhosts[0].PATH);
        }
        
        // -------------------
        // Handle autodeploy events
        // -------------------

        if (modules.repos) {
            modules.repos.hook(Ui, request, response, $config).then(async () => {
                await serverRestart(Ui, $config.RUNTIME_NAME);
                process.exit();
            }).catch(e => { fatal = e; });
        }

        // -------------------
        // Handle redirects
        // -------------------

        var rdr;
        if (modules.redirects) {
            rdr = await modules.redirects.match(location, $config);
            if (rdr) {
                response.statusCode = rdr.code;
                response.setHeader('Location', rdr.target);
                response.end();
            }
        }
        
        // -------------------
        // Handle request
        // -------------------

        if (!fatal && !rdr) {

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
            _each(location.query, (name, value) => {
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
            const router = new Router(location.pathname, $config);

            // The service object
            const service = {
                config: $config,
                // Request
                request,
                // Response
                response,
                // Piping utility
                route: async (...stack) => {
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
                    var file = await router.fetch(service.request.url);
                    // JSON request should ignore static files
                    if (file && !service.request.accepts.type(file.contentType)) {
                        return;
                    }
                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                        var prerenderMatch = modules.prerendering ? await !modules.prerendering.match(location.pathname, $config) : null;
                        if (!prerenderMatch) {
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
                                source: Path.join($config.ROOT, $config.PUBLIC_DIR, './index.html'),
                                url: location.href,
                                root: $config.ROOT,
                                g: 'GLOBAL_SSR_WINDOW' in $config ? $config.GLOBAL_SSR_WINDOW : 0,
                            });
                            const { window } = await import('@webqit/pseudo-browser/instance.js?' + instanceParams);
                            // --------
                            
                            // OOHTML would waiting for DOM-ready in order to be initialized
                            await window.WQ.OOHTML.ready;
                            if (!window.document.state.env) {
                                window.document.setState({
                                    env: 'server',
                                }, {update: true});
                            }
                            window.document.setState({page: data, location}, {update: true});
                            window.document.body.setAttribute('template', 'page' + location.pathname);
                            return window;
                        });
                        // --------
                        // Serialize rendering?
                        // --------
                        if (_isObject(window) && window.document) {
                            await window.WQ.DOM.templatesReady;
                            data = await _promise(resolve => {
                                setTimeout(() => {
                                    resolve({
                                        contentType: 'text/html',
                                        content: window.print(),
                                    });
                                }, $config.RENDER_DURATION || 1000);
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
                        };
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
                            var prerenderMatch = modules.prerendering ? await !modules.prerendering.match(location.pathname, $config) : null;
                            if (prerenderMatch) {
                                router.putPreRendered(location.pathname, `<!-- PRE-RENDERED -->\r\n` + data.content);
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

        if ($config.SHOW_REQUEST_LOG) {
            Ui.log(''
                + '[' + ($config.VHOST ? Ui.style.keyword($config.VHOST.HOST) + '][' : '') + Ui.style.comment((new Date).toUTCString()) + '] '
                + Ui.style.keyword(request.method) + ' '
                + Ui.style.url(request.url) + (data && data.autoIndex ? Ui.style.comment((!request.url.endsWith('/') ? '/' : '') + data.autoIndex) : '') + ' '
                + (data ? ' (' + Ui.style.comment(data.contentType) + ') ' : '')
                + (
                    [404, 500].includes(response.statusCode) 
                    ? Ui.style.err(response.statusCode + (fatal ? ` [ERROR]: ${fatal.error || fatal.toString()}` : ``)) 
                    : Ui.style.val(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + Ui.style.val(response.getHeader('location')) : '')
                )
            );
        }

        if (fatal) {
            if ($config.RUNTIME_MODE !== 'production') {
                console.trace(fatal);
                //Ui.error(fatal);
                process.exit();
            }
            throw fatal;
        }

    }).listen(PORT);

};
