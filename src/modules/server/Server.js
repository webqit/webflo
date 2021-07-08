
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import QueryString from 'querystring';
import _each from '@webqit/util/obj/each.js';
import _arrFrom from '@webqit/util/arr/from.js';
import _promise from '@webqit/util/js/promise.js';
import _isObject from '@webqit/util/js/isObject.js';
import ServerNavigationEvent from './ServerNavigationEvent.js';
import ServerResponseBuilder from './ServerResponseBuilder.js';
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

    if (setup.variables.autoload !== false && !setup.server.shared) {
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

        Http.createServer({ServerResponse: ServerResponseBuilder}, (request, response) => {
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

        const httpsServer = Https.createServer({ServerResponse: ServerResponseBuilder}, (request, response) => {
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
                    var domains = _arrFrom(_setup.server.https.certdoms);
                    if (!domains[0] || domains[0].trim() === '*') {
                        httpsServer.addContext(host, cert);
                        if (_setup.server.force_www) {
                            httpsServer.addContext(host.startsWith('www.') ? host.substr(4) : 'www.' + host, cert);
                        }
                    } else {
                        domains.forEach(domain => {
                            httpsServer.addContext(domain, cert);
                        });
                    }
                }
            });
        } else {
            if (Fs.existsSync(setup.server.https.keyfile)) {
                var domains = _arrFrom(setup.server.https.certdoms);
                var cert = {
                    key: Fs.readFileSync(setup.server.https.keyfile),
                    cert: Fs.readFileSync(setup.server.https.certfile),
                };
                if (!domains[0]) {
                    domains = ['*'];
                }
                domains.forEach(domain => {
                    httpsServer.addContext(domain, cert);
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

    // --------
    // Request parsing
    // --------

    const serverNavigationEvent = new ServerNavigationEvent(request, response, protocol);
    const $context = {
        rdr: null,
        layout: hostSetup.layout,
        env: {},
        response: null,
        fatal: false,
    };

    if (hostSetup.variables.autoload !== false) {
        Object.keys(hostSetup.variables.entries).forEach(key => {
            $context.env[key] = hostSetup.variables.entries[key];
        });
    }

    // -------------------
    // Handle redirects
    // -------------------

    if (config.redirects) {
        if ($context.rdr = await config.redirects.match(serverNavigationEvent.request.url, flags, hostSetup.layout)) {
            response.statusCode = $context.rdr.code;
            response.setHeader('Location', $context.rdr.target);
            response.end();
        }
    }
    
    // -------------------
    // Handle request
    // -------------------

    if (!$context.fatal && !$context.rdr) {

        try {

            // -------------------
            // Handle autodeploy events
            // -------------------

            // The app router
            const router = new Router(serverNavigationEvent.url.pathname, hostSetup.layout, $context);

            // --------
            // ROUTE FOR DEPLOY
            // --------
            if (cmd.origins) {
                await cmd.origins.hook(Ui, serverNavigationEvent.request, response, flags, hostSetup.layout).then(deploy => {
                    if (deploy) {
                        return router.route('deploy', [serverNavigationEvent], null, function() {
                            return deploy();
                        }, [response]);
                    }
                });
            }

            // --------
            // ROUTE FOR DATA
            // --------
            $context.response = await router.route([serverNavigationEvent.request.method.toLowerCase(), 'default'], [serverNavigationEvent], null, async function() {
                var file = await router.fetch(serverNavigationEvent.url.pathname);
                // JSON request should ignore static files
                if (file && !serverNavigationEvent.accepts.type(file.contentType)) {
                    return;
                }
                // ----------------
                // PRE-RENDERING
                // ----------------
                if (file && file.contentType === 'text/html' && (file.content + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                    var prerenderMatch = config.prerendering ? await !config.prerendering.match(serverNavigationEvent.url.pathname, flags, hostSetup.layout) : null;
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
                if (serverNavigationEvent.accepts.type('text/html')) {
                    // --------
                    // Render
                    // --------
                    const rendering = await router.route('render', [serverNavigationEvent], $context.response, async function(data) {
                        // --------
                        if (!hostSetup.layout.renderFileCache) {
                            hostSetup.layout.renderFileCache = {};
                        }
                        var renderFile, pathnameSplit = serverNavigationEvent.url.pathname.split('/');
                        while ((renderFile = Path.join(hostSetup.layout.ROOT, hostSetup.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
                        && pathnameSplit.length && (hostSetup.layout.renderFileCache[renderFile] === false || !(hostSetup.layout.renderFileCache[renderFile] && Fs.existsSync(renderFile)))) {
                            hostSetup.layout.renderFileCache[renderFile] === false;
                            pathnameSplit.pop();
                        }
                        hostSetup.layout.renderFileCache[renderFile] === true;
                        const instanceParams = QueryString.stringify({
                            SOURCE: renderFile,
                            URL: serverNavigationEvent.url.href,
                            ROOT: hostSetup.layout.ROOT,
                        });
                        const { window } = await import('@webqit/pseudo-browser/instance.js?' + instanceParams);
                        // --------
                        // OOHTML would waiting for DOM-ready in order to be initialized
                        await new Promise(res => window.WebQit.DOM.ready(res));
                        if (!window.document.state.env) {
                            window.document.setState({
                                env: 'server',
                            }, {update: true});
                        }
                        window.document.setState({page: data, url: serverNavigationEvent.request.url}, {update: 'merge'});
                        window.document.body.setAttribute('template', 'page/' + serverNavigationEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
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
                } else if (serverNavigationEvent.accepts.type('application/json')) {
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
                        if ($context.headers = await config.headers.match(serverNavigationEvent.request.url, flags, hostSetup.layout)) {
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
                        var prerenderMatch = config.prerendering ? await !config.prerendering.match(serverNavigationEvent.url.pathname, flags, hostSetup.layout) : null;
                        if (prerenderMatch) {
                            router.putPreRendered(serverNavigationEvent.url.pathname, `<!-- PRE-RENDERED -->\r\n` + $context.response.content);
                        }
                    }
                } else {
                    response.statusCode = 404;
                    response.end(`${serverNavigationEvent.request.url} not found!`);
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
            + Ui.style.keyword(protocol.toUpperCase() + ' ' + serverNavigationEvent.request.method) + ' '
            + Ui.style.url(serverNavigationEvent.request.url) + ($context.response && $context.response.autoIndex ? Ui.style.comment((!serverNavigationEvent.request.url.endsWith('/') ? '/' : '') + $context.response.autoIndex) : '') + ' '
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