
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Http from 'http';
import Https from 'https';
import Formidable from 'formidable';
import QueryString from 'querystring';
import Sessions from 'client-sessions';
import _each from '@webqit/util/obj/each.js';
import _arrFrom from '@webqit/util/arr/from.js';
import _promise from '@webqit/util/js/promise.js';
import _isObject from '@webqit/util/js/isObject.js';
import _isArray from '@webqit/util/js/isArray.js';
import { _isString, _isPlainObject, _isPlainArray } from '@webqit/util/js/index.js';
import _delay from '@webqit/util/js/delay.js';
import { slice as _streamSlice } from 'stream-slice';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import * as config from '../../config/index.js';
import * as services from '../../services/index.js';
import NavigationEvent from './NavigationEvent.js';
import Router from './Router.js';

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

    if (!setup.server.shared && setup.variables.autoload !== false) {
        Object.keys(setup.variables.entries).forEach(key => {
            process.env[key] = setup.variables.entries[key];
        });
    }

    const getSessionInitializer = (sesskey, hostname = null) => {
        const secret = sesskey || (hostname ? uuidv5(hostname, uuidv4()) : uuidv4());
        return Sessions({
            cookieName: '_session',             // cookie name dictates the key name added to the request object
            secret,                             // should be a large unguessable string
            duration: 24 * 60 * 60 * 1000,      // how long the session will stay valid in ms
            activeDuration: 1000 * 60 * 5       // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
        });
    };

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
            v_setup[vh.host].sessionInit = getSessionInitializer(v_setup[vh.host].variables.entries.sesskey, vh.host),
            resolve();
        })));
    } else {
        setup.sessionInit = getSessionInitializer(setup.variables.entries.sesskey);
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
            setup.sessionInit(request, response, () => {});
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

        const httpsServer = Https.createServer((request, response) => {
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

    const fullUrl = protocol + '://' + request.headers.host + request.url;
    const requestInit = { method: request.method, headers: request.headers };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        requestInit.body = await new Promise((resolve, reject) => {
            var formidable = new Formidable.IncomingForm({ multiples: true, allowEmptyFiles: false, keepExtensions: true });
            formidable.parse(request, (error, fields, files) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (request.headers['content-type'] === 'application/json') {
                    return resolve(fields);
                }
                const formData = new NavigationEvent.globals.FormData;
                Object.keys(fields).forEach(name => {
                    if (Array.isArray(fields[name])) {
                        const values = Array.isArray(fields[name][0]) 
                            ? fields[name][0]/* bugly a nested array when there are actually more than entry */ 
                            : fields[name];
                        values.forEach(value => {
                            formData.append(!name.endsWith(']') ? name + '[]' : name, value);
                        });
                    } else {
                        formData.append(name, fields[name]);
                    }
                });
                Object.keys(files).forEach(name => {
                    const fileCompat = file => {
                        // IMPORTANT
                        // Path up the "formidable" file in a way that "formdata-node"
                        // to can translate it into its own file instance
                        file[Symbol.toStringTag] = 'File';
                        file.stream = () => Fs.createReadStream(file.path);
                        // Done pathcing
                        return file;
                    }
                    if (Array.isArray(files[name])) {
                        files[name].forEach(value => {
                            formData.append(name, fileCompat(value));
                        });
                    } else {
                        formData.append(name, fileCompat(files[name]));
                    }
                });
                resolve(formData);
            });
        });
    }
    // The Formidabble thing in NavigationEvent class would still need
    // a reference to the Nodejs request
    const _request = new NavigationEvent.Request(fullUrl, requestInit);
    const serverNavigationEvent = new NavigationEvent(_request, request._session);
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
    $context.headers = config.headers ? await config.headers.match(serverNavigationEvent.request.url, flags, hostSetup.layout) : [];
    const resolveSetHeader = header => {
        var headerName = header.name.toLowerCase(),
            headerValue = header.value,
            isAppend = headerName.startsWith('+') ? (headerName = headerName.substr(1), true) : false,
            isPrepend = headerName.endsWith('+') ? (headerName = headerName.substr(0, headerName.length - 1), true) : false;
        if (isAppend || isPrepend) {
            headerValue = [ serverNavigationEvent.request.headers.get(headerName) || '' , headerValue].filter(v => v);
            headerValue = isPrepend ? headerValue.reverse().join(',') : headerValue.join(','); 
        }
        return { name: headerName, value: headerValue };
    }

    // -------------------
    // Handle redirects
    // -------------------

    if (config.redirects) {
        if ($context.rdr = await config.redirects.match(serverNavigationEvent.request.url, flags, hostSetup.layout)) {
            var redirectCode = $context.rdr.code || 301 /* Permanent */;
            response.statusCode = redirectCode;
            response.setHeader('Location', $context.rdr.target);
            response.end();
        }
    }

    // -------------------
    // Automatic request headers
    // -------------------
    
    $context.headers.filter(header => header.type === 'request').forEach(header => {
        const { name, value } = resolveSetHeader(header);
        serverNavigationEvent.request.headers.set(name, value);
    });

    // -------------------
    // Handle request
    // -------------------

    if (!$context.fatal && !$context.rdr) {

        try {

            // The app router
            const router = new Router(serverNavigationEvent.url.pathname, hostSetup.layout, $context);

            // --------
            // ROUTE FOR DEPLOY
            // --------
            if (services.origins) {
                await services.origins.hook(Ui, serverNavigationEvent, async (payload, defaultPeployFn) => {
                    var exitCode = await router.route('deploy', serverNavigationEvent, payload, function(event, _payload) {
                        return defaultPeployFn(_payload);
                    });
                    // -----------
                    response.statusCode = 200;
                    response.end(exitCode);
                    // -----------
                    return exitCode;
                }, flags, hostSetup.layout);
            }

            // --------
            // ROUTE FOR DATA
            // --------
            const httpMethodName = serverNavigationEvent.request.method.toLowerCase();
            $context.response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], serverNavigationEvent, null, async function(event) {
                var file = await router.fetch(event);
                // JSON request should ignore static files
                if (file && event.request.headers.get('Accept') && !event.request.headers.accept.match(file.headers.contentType)) {
                    return;
                }
                // ----------------
                // PRE-RENDERING
                // ----------------
                if (file && file.headers.contentType === 'text/html' && (file.body + '').startsWith(`<!-- PRE-RENDERED -->`)) {
                    if (config.prerendering && !(await !config.prerendering.match(serverNavigationEvent.url.pathname, flags, hostSetup.layout))) {
                        router.deletePreRendered(file.filename);
                        return;
                    }
                }
                return file;
            });

            // --------
            if (!($context.response instanceof serverNavigationEvent.Response)) {
                $context.response = new serverNavigationEvent.Response($context.response);
            }
            // --------

            // --------
            // API CALL OR PAGE REQUEST?
            // --------

            if (!$context.response.meta.static && (_isPlainObject($context.response.original) || _isPlainArray($context.response.original))) {
                if (serverNavigationEvent.request.headers.accept.match('text/html')) {
                    // --------
                    // Render
                    // --------
                    var rendering = await router.route('render', serverNavigationEvent, $context.response.original, async function(event, data) {
                        // --------
                        if (!hostSetup.layout.renderFileCache) {
                            hostSetup.layout.renderFileCache = {};
                        }
                        var renderFile, pathnameSplit = event.url.pathname.split('/');
                        while ((renderFile = Path.join(hostSetup.layout.ROOT, hostSetup.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
                        && pathnameSplit.length && (hostSetup.layout.renderFileCache[renderFile] === false || !(hostSetup.layout.renderFileCache[renderFile] && Fs.existsSync(renderFile)))) {
                            hostSetup.layout.renderFileCache[renderFile] === false;
                            pathnameSplit.pop();
                        }
                        hostSetup.layout.renderFileCache[renderFile] === true;
                        const instanceParams = QueryString.stringify({
                            SOURCE: renderFile,
                            URL: event.url.href,
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
                        window.document.setState({page: data, url: event.url}, {update: 'merge'});
                        window.document.body.setAttribute('template', 'page/' + event.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
                        return new Promise(res => {
                            window.document.addEventListener('templatesreadystatechange', () => res(window));
                            if (window.document.templatesReadyState === 'complete') {
                                res(window);
                            }
                        });
                    });
                    // --------
                    // Serialize rendering?
                    // --------
                    if (_isObject(rendering) && rendering.document) {
                        await _delay(2000);
                        rendering = rendering.print();
                    }
                    if (!_isString(rendering)) throw new Error('render() must return a window object or a string response.')
                    $context.response = new serverNavigationEvent.Response(rendering, {
                        status: $context.response.status,
                        headers: { ...$context.response.headers.json(), contentType: 'text/html' },
                    });
                }
            }

            // --------
            // SEND RESPONSE
            // --------

            if (!response.headersSent) {
                
                // -------------------
                // Streaming headers
                // -------------------
                // Chrome needs this for audio elements to play
                response.setHeader('Accept-Ranges', 'bytes');
                /*
                if ($context.response.headers.contentLength && !$context.response.headers.contentRange) {
                    $context.response.headers.contentRange = `bytes 0-${$context.response.headers.contentLength}/${$context.response.headers.contentLength}`;
                }

                */
                // -------------------
                // Automatic response headers
                // -------------------
                //response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                //response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
                $context.headers.filter(header => header.type === 'response').forEach(header => {
                    const { name, value } = resolveSetHeader(header);
                    response.setHeader(name, value);
                });

                // -------------------
                // Route response cookies
                // -------------------
                const cookieAtts = [ 'Expires', 'Max-Age', 'Domain', 'Path', 'Secure', 'HttpOnly', 'SameSite' ];
                const setCookies = (cookies, nameContext = null) => {
                    _each(cookies, (name, cookie) => {
                        name = nameContext ? `${nameContext}[${name}]` : name;
                        cookie = !_isObject(cookie) ? { value: cookie } : cookie;
                        var expr = `${name}=${cookie.value}`;
                        if (cookie.value === false && !('maxAge' in cookie)) {
                            cookie.maxAge = 0;
                        }
                        Object.keys(cookie).forEach(attr => {
                            if (attr === 'value') return;
                            var __attr = cookieAtts.reduce((match, _attr) => match || (
                                [_attr.toLowerCase(), _attr.replace('-', '').toLowerCase()].includes(attr.toLowerCase()) ? _attr : null
                            ), null);
                            if (!__attr) throw new Error(`Invalid cookie attribute: ${attr}`);
                            expr += cookie[attr] === true ? `; ${__attr}` : `; ${__attr}=${cookie[attr]}`;
                        });
                        response.setHeader('Set-Cookie', expr);
                        if (_isObject(cookie.children)) {
                            setCookies(cookie.children, name);
                        }
                    });
                };

                // -------------------
                // Route response headers
                // -------------------
                _each($context.response.headers.json(), (name, value) => {
                    if ([ 'autoindex', 'filename', 'static' ].includes(name)) return;
                    if (name === 'set-cookie') {
                        setCookies(value);
                    } else {
                        if (name.toLowerCase() === 'location' && !$context.response.status) {
                            response.statusCode = 302 /* Temporary */;
                        }
                        response.setHeader(name, value);
                    }
                });
                
                // -------------------
                // Send
                // -------------------
                if ($context.response.headers.redirect) {
                    response.end();
                } else if ($context.response.original !== undefined && $context.response.original !== null) {
                    response.statusCode = $context.response.status;
                    response.statusMessage = $context.response.statusText;

                    // ----------------
                    // SENDING RESPONSE
                    // ----------------
                    var body = $context.response.body;
                    if ((body instanceof serverNavigationEvent.globals.ReadableStream)
                    || (ArrayBuffer.isView(body) && (body = serverNavigationEvent.globals.ReadableStream.from(body)))) {

                        // We support streaming
                        const rangeRequest = serverNavigationEvent.request.headers.range;
                        if (rangeRequest) {
                            // ...in partials
                            const totalLength = $context.response.headers.contentLength;
                            // Validate offsets
                            if (rangeRequest[0] < 0 || (totalLength && rangeRequest[0] > totalLength) 
                            || (rangeRequest[1] > -1 && (rangeRequest[1] <= rangeRequest[0] || (totalLength && rangeRequest[1] >= totalLength)))) {
                                response.statusCode = 416;
                                response.setHeader('Content-Range', `bytes */${totalLength || '*'}`);
                                response.setHeader('Content-Length', 0);
                                response.end();
                            } else {
                                if (totalLength) {
                                    rangeRequest.clamp(totalLength);
                                }
                                // Set new headers
                                response.writeHead(206, {
                                    'Content-Range': `bytes ${rangeRequest[0]}-${rangeRequest[1]}/${totalLength || '*'}`,
                                    'Content-Length': rangeRequest[1] - rangeRequest[0] + 1,
                                });
                                body
                                    .pipe(_streamSlice(rangeRequest[0], rangeRequest[1]))
                                    .pipe(response);
                            }
                        } else {
                            // ...as a whole
                            body.pipe(response);
                        }
                    } else {
                        // The default
                        if ($context.response.headers.contentType === 'application/json') {
                            body += '';
                        }
                        response.end(body);
                    }

                    // ----------------
                    // PRE-RENDERING
                    // ----------------
                    if (!$context.response.meta.filename && $context.response.headers.contentType === 'text/html') {
                        var prerenderMatch = config.prerendering ? await !config.prerendering.match(serverNavigationEvent.url.pathname, flags, hostSetup.layout) : null;
                        if (prerenderMatch) {
                            router.putPreRendered(serverNavigationEvent.url.pathname, `<!-- PRE-RENDERED -->\r\n` + $context.response.original);
                        }
                    }
                } else if (!$context.response.headers.redirect) {
                    response.statusCode = $context.response.status !== 200 ? $context.response.status : 404;
                    response.end(`${serverNavigationEvent.request.url} not found!`);
                }

            }

        } catch(e) {

            $context.fatal = e;
            response.statusCode = 500;
            response.end(`Internal server error: ${e.errorCode}`);

        }

    }

    // --------
    // request log
    // --------

    if (flags.logs !== false) {
        Ui.log(''
            + '[' + (hostSetup.vh ? Ui.style.keyword(hostSetup.vh.host) + '][' : '') + Ui.style.comment((new Date).toUTCString()) + '] '
            + Ui.style.keyword(protocol.toUpperCase() + ' ' + serverNavigationEvent.request.method) + ' '
            + Ui.style.url(serverNavigationEvent.request.url) + ($context.response && ($context.response.meta || {}).autoIndex ? Ui.style.comment((!serverNavigationEvent.request.url.endsWith('/') ? '/' : '') + $context.response.meta.autoIndex) : '') + ' '
            + (' (' + Ui.style.comment($context.response && ($context.response.headers || {}).contentType ? $context.response.headers.contentType : 'unknown') + ') ')
            + (
                [ 404, 500 ].includes(response.statusCode) 
                ? Ui.style.err(response.statusCode + ($context.fatal ? ` [ERROR]: ${$context.fatal.error || $context.fatal.toString()}` : ``)) 
                : Ui.style.val(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + Ui.style.val(response.getHeader('Location')) : ' (' + Ui.style.keyword(response.getHeader('Content-Range') || response.statusMessage) + ')')
            )
        );
    }

    if ($context.fatal) {
        if (flags.env === 'dev') {
            console.trace($context.fatal);
            //Ui.error($context.fatal);
            process.exit();
        }
        throw $context.fatal;
    }

};