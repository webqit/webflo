
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
import * as config from '../../config/index.js';
import * as cmd from '../../cmd/index.js';

/**
 * The default initializer.
 * 
 * @param Ui        Ui
 * @param Object    flags
 * 
 * @return void
 */
export default async function(Ui, flags = {}) {

    const layout = await config.layout.read(flags, {});
    const setup = {
        layout,
        server: await config.server.read(flags, layout),
        variables: await config.variables.read(flags, layout),
    };

    if (setup.variables.autoload) {
        Object.keys(setup.variables.entries).forEach(key => {
            process.env[key] = setup.variables.entries[key];
        });
    }

    const instanceSetup = setup;
    
    const v_setup = {};
    if (setup.server.shared) {
        await Promise.all(((await config.vhosts.read(flags, setup.layout)).entries || []).map(vh => new Promise(async resolve => {
            const vlayout = await config.layout.read(flags, {ROOT: Path.join(setup.layout.ROOT, vh.path)});
            v_setup[vh.host] = {
                layout: vlayout,
                server: await config.server.read(flags, vlayout),
                variables: await config.variables.read(flags, vlayout),
                vh,
            };
            resolve();
        })));
    }

    // ---------------------------------------------
    
    const getVSetup = (request, response) => {
        var _setup, v_hostname = (request.headers.host || '').split(':')[0];
        if (_setup = v_setup[v_hostname]) {
            return _setup;
        }
        if ((v_hostname.startsWith('www.') && (_setup = v_setup[v_hostname.substr(4)]) && _setup.server.force_www)
        || (!v_hostname.startsWith('www.') && (_setup = v_setup['www.' + v_hostname]) && _setup.server.force_www)) {
            return _setup;
        }
        response.statusCode = 500;
        response.end('Unrecognized host');
    };

    const goOrForceWww = (setup, request, response, protocol) => {
        var hostname = request.headers.host || '';
        if (hostname.startsWith('www.') && setup.server.force_www === 'remove') {
            response.statusCode = 302;
            response.setHeader('Location', protocol + '://' + hostname.substr(4) + request.url);
            response.end();
        } else if (!hostname.startsWith('www.') && setup.server.force_www === 'add') {
            response.statusCode = 302;
            response.setHeader('Location', protocol + '://www.' + hostname + request.url);
            response.end();
        } else {
            run(instanceSetup, setup, request, response, Ui, flags, protocol);
        }
    };

    // ---------------------------------------------
    
    if (!flags['https-only']) {

        Http.createServer((request, response) => {
            if (setup.server.shared) {
                var _setup;
                if (_setup = getVSetup(request, response)) {
                    goOrForceHttps(_setup, request, response);
                }
            } else {
                goOrForceHttps(setup, request, response);
            }
        }).listen(setup.server.port);

        const goOrForceHttps = ($setup, $request, $response) => {
            if ($setup.server.https.force && !flags['http-only'] && /** main server */setup.server.https.port) {
                $response.statusCode = 302;
                $response.setHeader('Location', 'https://' + $request.headers.host + $request.url);
                $response.end();
            } else {
                goOrForceWww($setup, $request, $response, 'http');
            }
        };

    }

    // ---------------------------------------------

    if (!flags['http-only'] && setup.server.https.port) {

        const httpsServer = Https.createServer({}, (request, response) => {
            if (setup.server.shared) {
                var _setup;
                if (_setup = getVSetup(request, response)) {
                    goOrForceWww(_setup, request, response, 'https');
                }
            } else {
                goOrForceWww(setup, request, response, 'https');
            }
        });

        if (setup.server.shared) {
            _each(v_setup, (host, _setup) => {
                if (Fs.existsSync(_setup.server.https.keyfile)) {
                    const cert = {
                        key: Fs.readFileSync(_setup.server.https.keyfile),
                        cert: Fs.readFileSync(_setup.server.https.certfile),
                    };
                    httpsServer.addContext(host, cert);
                    if (_setup.server.force_www) {
                        httpsServer.addContext(host.startsWith('www.') ? host.substr(4) : 'www.' + host, cert);
                    }
                }
            });
        } else {
            if (Fs.existsSync(setup.server.https.keyfile)) {
                httpsServer.addContext('*', {
                    key: Fs.readFileSync(setup.server.https.keyfile),
                    cert: Fs.readFileSync(setup.server.https.certfile),
                });
            }
        }

        httpsServer.listen(setup.server.https.port);
    }
};

/**
 * The Server.
 * 
 * @param Object    instanceSetup
 * @param Object    hostSetup
 * @param Request   request
 * @param Response  response
 * @param Ui        Ui
 * @param Object    flags
 * @param String    protocol
 * 
 * @return void
 */
export async function run(instanceSetup, hostSetup, request, response, Ui, flags = {}, protocol = 'http') {

    request.URL = Url.parse(protocol + '://' + request.headers.host + request.url, true, true);
    const $context = {
        rdr: null,
        layout: hostSetup.layout,
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
        response: null,
        fatal: false,
    };

    if (hostSetup.variables.autoload) {
        Object.keys(hostSetup.variables.entries).forEach(key => {
            $context.env[key] = hostSetup.variables.entries[key];
        });
    }

    // -------------------
    // Handle redirects
    // -------------------

    if (config.redirects) {
        if ($context.rdr = await config.redirects.match(request.URL, flags, hostSetup.layout)) {
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

            if (cmd.origins) {
                cmd.origins.hook(Ui, request, response, flags, hostSetup.layout).then(async () => {
                    await serverRestart(Ui, instanceSetup.server.process.name);
                    process.exit();
                }).catch(e => { throw e; });
            }

            // The app router
            const router = new Router(request.URL.pathname, hostSetup.layout, $context);

            // --------
            // ROUTE FOR DATA
            // --------
            $context.response = await router.route([request.method.toLowerCase(), 'default'], [request], null, async function() {
                var file = await router.fetch(/*request.url*/this.pathname);
                // JSON request should ignore static files
                if (file && !request.accepts.type(file.contentType)) {
                    return;
                }
                // ----------------
                // PRE-RENDERING
                // ----------------
                if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                    var prerenderMatch = config.prerendering ? await !config.prerendering.match(request.URL.pathname, flags, hostSetup.layout) : null;
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
            if (!($context.response instanceof FixedResponse) && _isObject($context.response)) {
                if (request.accepts.type('text/html')) {
                    // --------
                    // Render
                    // --------
                    const rendering = await router.route('render', [request], $context.response, async function(data) {
                        // --------
                        if (!hostSetup.layout.renderFileCache) {
                            hostSetup.layout.renderFileCache = {};
                        }
                        var renderFile, pathnameSplit = request.URL.pathname.split('/');
                        while ((renderFile = Path.join(hostSetup.layout.ROOT, hostSetup.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
                        && pathnameSplit.length && (hostSetup.layout.renderFileCache[renderFile] === false || !(hostSetup.layout.renderFileCache[renderFile] && Fs.existsSync(renderFile)))) {
                            hostSetup.layout.renderFileCache[renderFile] === false;
                            pathnameSplit.pop();
                        }
                        hostSetup.layout.renderFileCache[renderFile] === true;
                        const instanceParams = QueryString.stringify({
                            SOURCE: renderFile,
                            URL: request.URL.href,
                            ROOT: hostSetup.layout.ROOT,
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
                        window.document.setState({page: data, url: request.URL}, {update: true});
                        window.document.body.setAttribute('template', 'page' + request.URL.pathname);
                        return new Promise(res => {
                            window.document.addEventListener('templatesreadystatechange', () => res(window));
                            if (window.document.templatesReadyState === 'complete') {
                                res(window);
                            }
                        });
                    }, [response]);
                    // --------
                    // Serialize rendering?
                    // --------
                    if (_isObject(rendering) && rendering.document) {
                        $context.response = await _promise(resolve => {
                            setTimeout(() => {
                                resolve({
                                    contentType: 'text/html',
                                    content: rendering.print(),
                                });
                            }, 1000);
                        });
                    } else {
                        $context.response = rendering;
                    }
                } else if (request.accepts.type('application/json')) {
                    // --------
                    // JSONfy
                    // --------
                    $context.response = {
                        contentType: 'application/json',
                        content: $context.response,
                    };
                }
            }

            // --------
            // SEND RESPONSE
            // --------

            if (!response.headersSent) {
                if ($context.response) {
                    // -------------------
                    // Handle headers
                    // -------------------
                    if (config.headers) {
                        if ($context.headers = await config.headers.match(request.URL, flags, hostSetup.layout)) {
                            $context.headers.forEach(header => {
                                response.setHeader(header.name, header.value);
                            });
                        }
                    }
                    response.setHeader('Content-type', $context.response.contentType);
                    if ($context.response.nostore) {
                        response.setHeader('Cache-Control', 'no-store');
                    }
                    if ($context.response.cors) {
                        response.setHeader('Access-Control-Allow-Origin', $context.response.cors === true ? '*' : $context.response.cors);
                    }
                    response.end(
                        $context.response.contentType === 'application/json' && _isObject($context.response.content) 
                            ? JSON.stringify($context.response.content) 
                            : $context.response.content
                    );
                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (!$context.response.filename && $context.response.contentType === 'text/html') {
                        var prerenderMatch = config.prerendering ? await !config.prerendering.match(request.URL.pathname, flags, hostSetup.layout) : null;
                        if (prerenderMatch) {
                            router.putPreRendered(request.URL.pathname, `<!-- PRE-RENDERED -->\r\n` + $context.response.content);
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
            + '[' + (hostSetup.vh ? Ui.style.keyword(hostSetup.vh.host) + '][' : '') + Ui.style.comment((new Date).toUTCString()) + '] '
            + Ui.style.keyword(protocol.toUpperCase() + ' ' + request.method) + ' '
            + Ui.style.url(request.url) + ($context.response && $context.response.autoIndex ? Ui.style.comment((!request.url.endsWith('/') ? '/' : '') + $context.response.autoIndex) : '') + ' '
            + ($context.response ? ' (' + Ui.style.comment($context.response.contentType) + ') ' : '')
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