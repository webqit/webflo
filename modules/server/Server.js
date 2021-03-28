
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
import * as _layout from '../../config/layout.js';
import * as _variables from '../../config/variables.js';
import * as server from '../../config/server.js';
import * as vhosts from '../../config/vhosts.js';
import * as headers from '../../config/headers.js';
import * as redirects from '../../config/redirects.js';
import * as prerendering from '../../config/prerendering.js';
import * as origins from '../../cmd/origins.js';

/**
 * The default initializer.
 * 
 * @param Ui        Ui
 * @param Object    flags
 * 
 * @return void
 */
export default async function(Ui, flags = {}) {
    const layout = await _layout.read(flags, {});
    const config = {
        server: await server.read(flags, layout),
        variables: await _variables.read(flags, {}),
        vhosts,
        redirects,
        headers,
        origins,
        prerendering,
    };

    if (config.variables.autoload) {
        Object.keys(config.variables.entries).forEach(key => {
            process.env[key] = config.variables.entries[key];
        });
    }

    const instanceConfig = config;
    
    const v_configs = {};
    if (config.server.shared) {
        await Promise.all(((await vhosts.read(flags, layout)).entries || []).map(async vh => {
            var vlayout = await _layout.read(flags, {ROOT: Path.join(layout.ROOT, vh.path)});
            var vconfig = {
                server: await server.read(flags, vlayout),
                variables: await _variables.read(flags, vlayout),
                vhosts,
                redirects,
                headers,
                origins,
                prerendering,
            };
            v_configs[vh.host] = { layout: vlayout, config: vconfig, vh, };
        }));
    }

    // ---------------------------------------------
    
    const getVConfig = (request, response) => {
        var v_config, v_hostname = (request.headers.host || '').split(':')[0];
        if (v_config = v_configs[v_hostname]) {
            return v_config;
        }
        if ((v_hostname.startsWith('www.') && (v_config = v_configs[v_hostname.substr(4)]) && v_config.config.server.force_www)
        || (!v_hostname.startsWith('www.') && (v_config = v_configs['www.' + v_hostname]) && v_config.config.server.force_www)) {
            return v_config;
        }
        response.statusCode = 500;
        response.end('Unrecognized host');
    };

    const goOrForceWww = (layout, config, request, response, protocol, isVhost) => {
        var hostname = request.headers.host || '';
        if (hostname.startsWith('www.') && config.server.force_www === 'remove') {
            response.statusCode = 302;
            response.setHeader('Location', protocol + '://' + hostname.substr(4) + request.url);
            response.end();
        } else if (!hostname.startsWith('www.') && config.server.force_www === 'add') {
            response.statusCode = 302;
            response.setHeader('Location', protocol + '://www.' + hostname + request.url);
            response.end();
        } else {
            run(instanceConfig, layout, config, request, response, Ui, flags, protocol, isVhost);
        }
    };

    // ---------------------------------------------
    
    if (!flags['https-only']) {

        Http.createServer((request, response) => {
            if (config.server.shared) {
                var v_config;
                if (v_config = getVConfig(request, response)) {
                    goOrForceHttps(v_config.layout, v_config.config, request, response, v_config.vh);
                }
            } else {
                goOrForceHttps(layout, config, request, response);
            }
        }).listen(config.server.port);

        const goOrForceHttps = (_layout, _config, _request, _response, isVhost) => {
            if (_config.server.https.force && !flags['http-only'] && /** main server */config.server.https.port) {
                _response.statusCode = 302;
                _response.setHeader('Location', 'https://' + _request.headers.host + _request.url);
                _response.end();
            } else {
                goOrForceWww(_layout, _config, _request, _response, 'http', isVhost);
            }
        };

    }

    // ---------------------------------------------

    if (!flags['http-only'] && config.server.https.port) {

        const httpsServer = Https.createServer({}, (request, response) => {
            if (config.server.shared) {
                var v_config;
                if (v_config = getVConfig(request, response)) {
                    goOrForceWww(v_config.layout, v_config.config, request, response, 'https', v_config.vh);
                }
            } else {
                goOrForceWww(layout, config, request, response, 'https');
            }
        });

        if (config.server.shared) {
            _each(v_configs, (host, v_config) => {
                if (Fs.existsSync(v_config.config.server.https.keyfile)) {
                    const cert = {
                        key: Fs.readFileSync(v_config.config.server.https.keyfile),
                        cert: Fs.readFileSync(v_config.config.server.https.certfile),
                    };
                    httpsServer.addContext(host, cert);
                    if (v_config.config.server.force_www) {
                        httpsServer.addContext(host.startsWith('www.') ? host.substr(4) : 'www.' + host, cert);
                    }
                }
            });
        } else {
            if (Fs.existsSync(config.server.https.keyfile)) {
                httpsServer.addContext('*', {
                    key: Fs.readFileSync(config.server.https.keyfile),
                    cert: Fs.readFileSync(config.server.https.certfile),
                });
            }
        }

        httpsServer.listen(config.server.https.port);
    }
};

/**
 * The Server.
 * 
 * @param Object    instanceConfig
 * @param Object    layout
 * @param Object    config
 * @param Request   request
 * @param Response  response
 * @param Ui        Ui
 * @param Object    flags
 * @param String    protocol
 * 
 * @return void
 */
export async function run(instanceConfig, layout, config, request, response, Ui, flags = {}, protocol = 'http', vhost = null) {

    const $layout = {...layout};
    request.URL = Url.parse(protocol + '://' + request.headers.host + request.url, true, true);
    const $context = {
        rdr: null,
        layout: $layout,
        env: {},
        // Piping utility
        walk: async (...stack) => {
            var val;
            var next = async function() {
                var middleware = stack.shift();
                if (middleware) {
                    val = await middleware(request, response, next);
                    return val;
                }
            };
            await next();
            return val;
        },
        fatal: false,
        data: null,
    };

    if (config.variables.autoload) {
        Object.keys(config.variables.entries).forEach(key => {
            $context.env[key] = config.variables.entries[key];
        });
    }

    // -------------------
    // Handle redirects
    // -------------------

    if (config.redirects) {
        if ($context.rdr = await config.redirects.match(request.URL, flags, $layout)) {
            response.statusCode = $context.rdr.code;
            response.setHeader('Location', $context.rdr.target);
            response.end();
        }
    }
    
    // -------------------
    // Handle request
    // -------------------

    if (!$context.fatal && !$context.rdr) {

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
        _each(request.URL.query, (name, value) => {
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
                config.origins.hook(Ui, request, response, flags, $layout).then(async () => {
                    await serverRestart(Ui, instanceConfig.server.process.name);
                    process.exit();
                }).catch(e => { throw e; });
            }

            // The app router
            const router = new Router(request.URL.pathname, $layout, $context);

            // --------
            // ROUTE FOR DATA
            // --------
            $context.data = await router.route([request.method.toLowerCase(), 'default'], [request], null, async function() {
                var file = await router.fetch(/*request.url*/this.pathname);
                // JSON request should ignore static files
                if (file && !request.accepts.type(file.contentType)) {
                    return;
                }
                // ----------------
                // PRE-RENDERING
                // ----------------
                if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                    var prerenderMatch = config.prerendering ? await !config.prerendering.match(request.URL.pathname, flags, $layout) : null;
                    if (!prerenderMatch) {
                        router.deletePreRendered(file.filename);
                        return;
                    }
                }
                return file;
            }, [response]);
            // --------
            // ROUTE FOR RENDERING?
            // --------
            if (!($context.data instanceof FixedResponse) && _isObject($context.data)) {
                if (request.accepts.type('text/html')) {
                    // --------
                    // Render
                    // --------
                    const window = await router.route('render', [], $context.data, async function() {
                        if (arguments.length) {
                            return;
                        }
                        // --------
                        if (!$layout.renderFileCache) {
                            $layout.renderFileCache = {};
                        }
                        var renderFile, pathnameSplit = request.URL.pathname.split('/');
                        while ((renderFile = Path.join($layout.ROOT, $layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
                        && pathnameSplit.length && ($layout.renderFileCache[renderFile] === false || !($layout.renderFileCache[renderFile] && Fs.existsSync(renderFile)))) {
                            $layout.renderFileCache[renderFile] === false;
                            pathnameSplit.pop();
                        }
                        $layout.renderFileCache[renderFile] === true;
                        const instanceParams = QueryString.stringify({
                            SOURCE: renderFile,
                            URL: request.URL.href,
                            ROOT: $layout.ROOT,
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
                        window.document.setState({page: $context.data, url: request.URL}, {update: true});
                        window.document.body.setAttribute('template', 'page' + request.URL.pathname);
                        return window;
                    });
                    // --------
                    // Serialize rendering?
                    // --------
                    if (_isObject(window) && window.document) {
                        await window.WQ.DOM.templatesReady;
                        $context.data = await _promise(resolve => {
                            setTimeout(() => {
                                resolve({
                                    contentType: 'text/html',
                                    content: window.print(),
                                });
                            }, 1000);
                        });
                    } else {
                        $context.data = window;
                    }
                } else if (request.accepts.type('application/json')) {
                    // --------
                    // JSONfy
                    // --------
                    $context.data = {
                        contentType: 'application/json',
                        content: $context.data,
                    };
                }
            }

            // --------
            // SEND RESPONSE
            // --------

            if (!response.headersSent) {
                if ($context.data) {
                    // -------------------
                    // Handle headers
                    // -------------------
                    if (config.headers) {
                        if ($context.headers = await config.headers.match(request.URL, flags, $layout)) {
                            $context.headers.forEach(header => {
                                response.setHeader(header.name, header.value);
                            });
                        }
                    }
                    response.setHeader('Content-type', $context.data.contentType);
                    if ($context.data.nostore) {
                        response.setHeader('Cache-Control', 'no-store');
                    }
                    if ($context.data.cors) {
                        response.setHeader('Access-Control-Allow-Origin', $context.data.cors === true ? '*' : $context.data.cors);
                    }
                    response.end(
                        $context.data.contentType === 'application/json' && _isObject($context.data.content) 
                            ? JSON.stringify($context.data.content) 
                            : $context.data.content
                    );
                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (!$context.data.filename && $context.data.contentType === 'text/html') {
                        var prerenderMatch = config.prerendering ? await !config.prerendering.match(request.URL.pathname, flags, $layout) : null;
                        if (prerenderMatch) {
                            router.putPreRendered(request.URL.pathname, `<!-- PRE-RENDERED -->\r\n` + $context.data.content);
                        }
                    }
                } else {
                    response.statusCode = 404;
                    response.end(`${request.url} not found!`);
                }
            }

        } catch(e) {

            $context.fatal = e;
            response.statusCode = e.errorCode || 500;
            response.end(`Internal server error!`);

        }

    }

    // --------
    // request log
    // --------

    if (flags.logs !== false) {
        Ui.log(''
            + '[' + (vhost ? Ui.style.keyword(vhost.host) + '][' : '') + Ui.style.comment((new Date).toUTCString()) + '] '
            + Ui.style.keyword(protocol.toUpperCase() + ' ' + request.method) + ' '
            + Ui.style.url(request.url) + ($context.data && $context.data.autoIndex ? Ui.style.comment((!request.url.endsWith('/') ? '/' : '') + $context.data.autoIndex) : '') + ' '
            + ($context.data ? ' (' + Ui.style.comment($context.data.contentType) + ') ' : '')
            + (
                [404, 500].includes(response.statusCode) 
                ? Ui.style.err(response.statusCode + ($context.fatal ? ` [ERROR]: ${$context.fatal.error || $context.fatal.toString()}` : ``)) 
                : Ui.style.val(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + Ui.style.val(response.getHeader('Location')) : '')
            )
        );
    }

    if ($context.fatal) {
        if (flags.dev) {
            console.trace($context.fatal);
            //Ui.error($context.fatal);
            process.exit();
        }
        throw $context.fatal;
    }

};