
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
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
import * as _setup from '../../config/setup.js';
import * as server from '../../config/server.js';
import * as vhosts from '../../config/vhosts.js';
import * as redirects from '../../config/redirects.js';
import * as origins from '../../cmd/origins.js';
import * as prerendering from '../../config/prerendering.js';

/**
 * The default initializer.
 * 
 * @param Ui        Ui
 * @param Object    flags
 * 
 * @return void
 */
export default async function(Ui, flags = {}) {
    const setup = await _setup.read({});
    const config = { server: await server.read(setup), vhosts, redirects, origins, prerendering, };
    
    const v_configs = {};
    if (config.server.shared) {
        await Promise.all(((await vhosts.read(setup)).entries || []).map(async vh => {
            var vsetup = await _setup.read({ROOT: Path.join(setup.ROOT, vh.path)});
            var vconfig = { server: await server.read(vsetup), vhosts, redirects, origins, prerendering, };
            v_configs[vh.host] = { setup: vsetup, config: vconfig, vh, };
        }));
    }
    
    if (!flags.https_only) {
        Http.createServer((request, response) => {
            if (config.server.https.port && config.server.https.force && !flags.http_only) {
                response.statusCode = 302;
                response.setHeader('Location', 'https://' + request.headers.host + request.url);
                response.end();
            } else {
                if (config.server.shared) {
                    // ----------------
                    var v_config;
                    if (v_config = v_configs[request.headers.host.split(':')[0]]) {
                        run(v_config.setup, v_config.config, request, response, Ui, flags, 'http', v_config.vh);
                    }
                    // ----------------
                } else {
                    // ----------------
                    run(setup, config, request, response, Ui, flags, 'http');
                    // ----------------
                }
            }
        }).listen(config.server.port);
    }

    if (!flags.http_only && config.server.https.port) {
        var httpsServer;
        if (config.server.shared) {
            // --------------
            httpsServer = Https.createServer({}, (request, response) => {
                var v_config;
                if (v_config = v_configs[request.headers.host.split(':')[0]]) {
                    run(v_config.setup, v_config.config, request, response, Ui, flags, 'https', v_config.vh);
                }
            });
            // --------------
            _each(v_configs, (host, v_config) => {
                if (!v_config.config.server.https.keyfile) {
                    throw new Error('HTTPS: config/server/https.keyfile is not configured for host: ' + host + '.');
                }
                if (!v_config.config.server.https.certfile) {
                    throw new Error('HTTPS: config/server/https.certfile is not configured for host: ' + host + '.');
                }
                httpsServer.addContext(host, {
                    key: Fs.readFileSync(v_config.config.server.https.keyfile),
                    cert: Fs.readFileSync(v_config.config.server.https.certfile),
                });
            });
            // ----------------
        } else {
            // ----------------
            if (!config.server.https.keyfile) {
                throw new Error('HTTPS: config/server/https.keyfile is not configured.');
            }
            if (!config.server.https.certfile) {
                throw new Error('HTTPS: config/server/https.certfile is not configured.');
            }
            httpsServer = Https.createServer({
                key: Fs.readFileSync(config.server.https.keyfile),
                cert: Fs.readFileSync(config.server.https.certfile),
            }, (request, response) => {
                run(setup, config, request, response, Ui, flags, 'https');
            });
            // ----------------
        }

        httpsServer.listen(config.server.https.port);
    }
};

/**
 * The Server.
 * 
 * @param Object    setup
 * @param Object    setup
 * @param Request   request
 * @param Response  response
 * @param Ui        Ui
 * @param Object    flags
 * @param String    protocol
 * 
 * @return void
 */
export async function run(setup, config, request, response, Ui, flags = {}, protocol = 'http', vhost = null) {

    const $setup = {...setup};
    const flow = {
        setup: $setup,
        protocol,
        request,
        response,
        location: Url.parse(protocol + '://' + request.headers.host + request.url, true, true),
        vhost: vhost,
        fatal: false,
        rdr: null,
        data: null,
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

    // -------------------
    // Handle redirects
    // -------------------

    if (config.redirects) {
        if (flow.rdr = await config.redirects.match(flow.location, $setup)) {
            response.statusCode = flow.rdr.code;
            response.setHeader('Location', flow.rdr.target);
            response.end();
        }
    }
    
    // -------------------
    // Handle request
    // -------------------

    if (!flow.fatal && !flow.rdr) {

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
        _each(flow.location.query, (name, value) => {
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

        try {

            // -------------------
            // Handle autodeploy events
            // -------------------

            if (config.origins) {
                config.origins.hook(Ui, request, response, $setup).then(async () => {
                    await serverRestart(Ui, config.server.process.name);
                    process.exit();
                }).catch(e => { throw e; });
            }

            // The app router
            const router = new Router(flow.location.pathname, $setup);

            // --------
            // ROUTE FOR DATA
            // --------
            flow.data = await router.route([flow], [request.method.toLowerCase(), 'default'], async function(output) {
                if (arguments.length) {
                    return output;
                }
                var file = await router.fetch(request.url);
                // JSON request should ignore static files
                if (file && !request.accepts.type(file.contentType)) {
                    return;
                }
                // ----------------
                // PRE-RENDERING
                // ----------------
                if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                    var prerenderMatch = config.prerendering ? await !config.prerendering.match(flow.location.pathname, $setup) : null;
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
            if (!(flow.data instanceof FixedResponse) && _isObject(flow.data)) {
                if (request.accepts.type('text/html')) {
                    // --------
                    // Render
                    // --------
                    const window = await router.route([flow.data], 'render', async function(_window) {
                        if (arguments.length) {
                            return _window;
                        }
                        // --------
                        const instanceParams = QueryString.stringify({
                            SOURCE: Path.join($setup.ROOT, $setup.PUBLIC_DIR, './index.html'),
                            URL: flow.location.href,
                            ROOT: $setup.ROOT,
                            G: 0,
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
                        window.document.setState({page: flow.data, location: flow.location}, {update: true});
                        window.document.body.setAttribute('template', 'page' + flow.location.pathname);
                        return window;
                    });
                    // --------
                    // Serialize rendering?
                    // --------
                    if (_isObject(window) && window.document) {
                        await window.WQ.DOM.templatesReady;
                        flow.data = await _promise(resolve => {
                            setTimeout(() => {
                                resolve({
                                    contentType: 'text/html',
                                    content: window.print(),
                                });
                            }, 1000);
                        });
                    } else {
                        flow.data = window;
                    }
                } else if (request.accepts.type('application/json')) {
                    // --------
                    // JSONfy
                    // --------
                    flow.data = {
                        contentType: 'application/json',
                        content: flow.data,
                    };
                }
            }

            // --------
            // SEND RESPONSE
            // --------

            if (!response.headersSent) {
                if (flow.data) {
                    response.setHeader('Content-type', flow.data.contentType);
                    if (flow.data.nostore) {
                        response.setHeader('Cache-Control', 'no-store');
                    }
                    if (flow.data.cors) {
                        response.setHeader('Access-Control-Allow-Origin', flow.data.cors === true ? '*' : flow.data.cors);
                    }
                    response.end(
                        flow.data.contentType === 'application/json' && _isObject(flow.data.content) 
                            ? JSON.stringify(flow.data.content) 
                            : flow.data.content
                    );
                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (!flow.data.filename && flow.data.contentType === 'text/html') {
                        var prerenderMatch = config.prerendering ? await !config.prerendering.match(flow.location.pathname, $setup) : null;
                        if (prerenderMatch) {
                            router.putPreRendered(flow.location.pathname, `<!-- PRE-RENDERED -->\r\n` + flow.data.content);
                        }
                    }
                } else {
                    response.statusCode = 404;
                    response.end(`${request.url} not found!`);
                }
            }

        } catch(e) {

            flow.fatal = e;
            response.statusCode = e.errorCode || 500;
            response.end(`Internal server error!`);

        }

    }

    // --------
    // request log
    // --------

    if (flags.logs !== false) {
        Ui.log(''
            + '[' + (flow.vhost ? Ui.style.keyword(flow.vhost.host) + '][' : '') + Ui.style.comment((new Date).toUTCString()) + '] '
            + Ui.style.keyword(protocol.toUpperCase() + ' ' + request.method) + ' '
            + Ui.style.url(request.url) + (flow.data && flow.data.autoIndex ? Ui.style.comment((!request.url.endsWith('/') ? '/' : '') + flow.data.autoIndex) : '') + ' '
            + (flow.data ? ' (' + Ui.style.comment(flow.data.contentType) + ') ' : '')
            + (
                [404, 500].includes(response.statusCode) 
                ? Ui.style.err(response.statusCode + (flow.fatal ? ` [ERROR]: ${flow.fatal.error || flow.fatal.toString()}` : ``)) 
                : Ui.style.val(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + Ui.style.val(response.getHeader('location')) : '')
            )
        );
    }

    if (flow.fatal) {
        if (flags.dev) {
            console.trace(flow.fatal);
            //Ui.error(flow.fatal);
            process.exit();
        }
        throw flow.fatal;
    }

};