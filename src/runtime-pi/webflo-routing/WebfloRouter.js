import { _isFunction, _isArray, _isObject } from '@webqit/util/js/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';
import { LiveResponse } from '../webflo-fetch/LiveResponse.js';
import { request as requestShim } from '../webflo-fetch/index.js';
import { path as Path } from '../webflo-url/util.js';

export class WebfloRouter {

    #runtime;
    #path;

    constructor(runtime, path = []) {
        this.#runtime = runtime;
        this.#path = _isArray(path) ? path : (path + '').split('/').filter(a => a);
    }

    async route(method, event, _default = null, remoteFetch = null) {
        const $this = this;
        const callWebfloDefault = async (thisContext, thisTick) => {
            let returnValue;
            if (_default) {
                returnValue = await _default.call(thisContext, thisTick.event, remoteFetch);
            }
            return returnValue;
        };
        // ----------------
        // The loop
        // ----------------
        const next = async function (thisTick) {
            const thisContext = {};
            if (!thisTick.trail || thisTick.trail.length < thisTick.destination.length) {
                thisTick = await $this.readTick(thisTick);
                // -------------
                thisContext.pathname = `/${thisTick.trail.join('/')}`;
                thisContext.stepname = thisTick.trail[thisTick.trail.length - 1];
                $this.finalizeHandlerContext(thisContext, thisTick);
                // -------------
                if (!thisTick.exports) {
                    if ((thisTick.currentSegmentOnFile || {}).dirExists) {
                        // Exports not found but directory found
                        return next(thisTick);
                    }
                    // Exports not found and directory not found
                    return callWebfloDefault(thisContext, thisTick);
                }
                // -------------
                // Broadcast any hints exported by handler
                //@obsolete if (thisTick.exports.hints) { await event.port.post({ ...thisTick.exports.hints, $type: 'handler:hints' }); }
                const methods = _arrFrom(thisTick.method).map(m => m === 'default' ? m : m.toUpperCase());
                const handler = _isFunction(thisTick.exports) && methods.includes('default')
                    ? thisTick.exports
                    : methods.reduce((_handler, name) => _handler || thisTick.exports[name], null);
                if (!handler) {
                    // Handler not found but exports found
                    return next(thisTick);
                }
                // -------------
                // Handler found
                // -------------
                const go = async (isFetch, ...args) => {
                    const nextTick = { ...thisTick };
                    let asResponse = false;

                    if (args.length) {

                        // Obtain URL
                        let url = args[0] instanceof Request ? args[0].url : (
                            !isFetch && _isObject(args[0]) ? (
                                args[0].redirect ?? thisTick.destination.slice(thisTick.trail.length).join('/')
                            ) : args[0]
                        );
                        let urlStr_isRelative = false;
                        let urlStr_resolved;

                        // Normalize URL
                        if (url instanceof URL) {
                            urlStr_resolved = url.href;
                        } else if (typeof url === 'string') {
                            urlStr_resolved = url.trim();
                            if (!/^http(s)?\:/i.test(urlStr_resolved) && !urlStr_resolved.startsWith('/')) {
                                urlStr_resolved = $this.pathJoin(`/${thisTick.trail.join('/')}`, urlStr_resolved);
                                if (urlStr_resolved.startsWith('../')) {
                                    throw new Error('Router redirect cannot traverse beyond the routing directory! (' + url + ' >> ' + urlStr_resolved + ')');
                                }
                                urlStr_isRelative = true;
                            }
                            url = new URL(urlStr_resolved, thisTick.event.url.origin);
                        } else {
                            throw new Error('Router redirect url must be instance of URL or a string.');
                        }

                        // Handle absolute URLs
                        if (url.origin !== thisTick.event.url.origin) {
                            if (!isFetch) {
                                throw new Error('The next() function cannot make outbound calls!');
                            }
                            const result = await remoteFetch(...args);
                            if (asResponse) {
                            }
                            return result;
                        }

                        // Build request inheritance chain
                        const requestInheritanceChain = [url];
                        if (!isFetch && thisTick.event.request instanceof Request) {
                            const { url: _, ...init } = await requestShim.copy.value(thisTick.event.request);
                            requestInheritanceChain.push(init);
                        }
                        const noArg2 = () => {
                            throw new Error('Invalid argument #2.');
                        };
                        if (args[0] instanceof Request) {
                            if (args[1]) noArg2();
                            const { url: _, ...init } = await requestShim.copy.value(args[0]);
                            requestInheritanceChain.push(init);
                        } else if (!isFetch && _isObject(args[0])) {
                            if (args[1]) noArg2();
                            if (_isObject(args[0].with)) {
                                requestInheritanceChain.push(args[0].with);
                            }
                            asResponse = args[0].live;
                        } else if (args[1] instanceof Request) {
                            requestInheritanceChain.push(args[1]);
                        } else if (_isObject(args[1])) {
                            const { live, ...init } = args[1];
                            requestInheritanceChain.push(init);
                            asResponse = live;
                        }

                        // Compose new event parameters
                        const request = requestInheritanceChain.reduce((prev, curr = {}) => new Request(prev, curr), requestInheritanceChain.shift());

                        // Set context parameters
                        nextTick.method = request.method;
                        nextTick.event = await thisTick.event.extend({ request });
                        nextTick.source = thisTick.destination.join('/');
                        nextTick.destination = url.pathname.split('/').map((a) => a.trim()).filter((a) => a);
                        nextTick.trail = !urlStr_isRelative ? [] : thisTick.trail.reduce((_commonRoot, _seg, i) => _commonRoot.length === i && _seg === nextTick.destination[i] ? _commonRoot.concat(_seg) : _commonRoot, []);
                        nextTick.trailOnFile = thisTick.trailOnFile.slice(0, nextTick.trail.length);
                    } else {
                        if (isFetch) {
                            throw new Error('fetch() cannot be called without arguments!');
                        }
                        nextTick.event = thisTick.event.extend();
                    }
                    const result = await next(nextTick);
                    if (asResponse) {
                    }
                    return result;
                };

                // Prepare handler parameters
                const nextPathname = thisTick.destination.slice(thisTick.trail.length);
                const $next = async (...args) => await go(false, ...args);
                $next.pathname = nextPathname.join('/');
                $next.stepname = nextPathname[0];
                const $fetch = async (...args) => await go(true, ...args);

                // Dispatch to handler
                return new Promise(async (resolve) => {
                    let resolved = 0;

                    // Monitor first respondWith()
                    thisTick.event.internalLiveResponse.addEventListener('replace', () => {
                        if (!resolved) {
                            resolved = 1;
                            resolve(thisTick.event.internalLiveResponse);
                        } else if (resolved === 2) {
                            throw new Error(`Unexpected respondWith() after handler return.`);
                        }
                    });

                    // Call the handler
                    const returnValue = await handler.call(thisContext, thisTick.event, $next/*next*/, $fetch/*fetch*/);

                    // Handle cleanup on abort
                    if (LiveResponse.test(returnValue) === 'LiveProgramHandle') {
                        thisTick.event.signal.addEventListener('abort', () => {
                            returnValue.abort();
                        });
                    } else if (LiveResponse.test(returnValue) === 'Generator') {
                        thisTick.event.signal.addEventListener('abort', () => {
                            if (typeof returnValue.return === 'function') {
                                returnValue.return();
                            }
                        });
                    }

                    // Handle return value
                    if (!resolved) {
                        resolved = 2;
                        resolve(returnValue);
                    } else if (typeof returnValue !== 'undefined') {
                        thisTick.event.internalLiveResponse.replaceWith(returnValue, { done: true });
                    }
                });
            }
            return callWebfloDefault(thisContext, thisTick);
        };

        return next({
            destination: this.#path,
            event,
            method
        });

    }

    async readTick(thisTick) {
        thisTick = { ...thisTick };
        var routeTree = this.#runtime.routes;
        var routePaths = Object.keys(this.#runtime.routes);
        if (thisTick.trail) {
            thisTick.currentSegment = thisTick.destination[thisTick.trail.length];
            thisTick.currentSegmentOnFile = [thisTick.currentSegment, '-'].reduce((_segmentOnFile, _seg) => {
                if (_segmentOnFile.handler) return _segmentOnFile;
                var _currentPath = `/${thisTick.trailOnFile.concat(_seg).join('/')}`;
                return routeTree[_currentPath] ? { seg: _seg, handler: _currentPath } : (
                    routePaths.filter((p) => p.startsWith(`${_currentPath}/`)).length ? { seg: _seg, dirExists: true } : _segmentOnFile
                );
            }, { seg: null });
            thisTick.trail = thisTick.trail.concat(thisTick.currentSegment);
            thisTick.trailOnFile = thisTick.trailOnFile.concat(thisTick.currentSegmentOnFile.seg);
            thisTick.exports = routeTree[thisTick.currentSegmentOnFile.handler];
        } else {
            thisTick.trail = [];
            thisTick.trailOnFile = [];
            thisTick.currentSegmentOnFile = { handler: '/' };
            thisTick.exports = routeTree['/'];
            if (!routeTree['/'] && routePaths.length) {
                thisTick.currentSegmentOnFile.dirExists = true;
            }
        }
        if (typeof thisTick.exports === 'string') {
            thisTick.exports = await import(thisTick.exports);
        }
        return thisTick;
    }

    finalizeHandlerContext(context, thisTick) {
        return context.dirname = thisTick.currentSegmentOnFile.handler;
    }

    pathJoin(...args) {
        return Path.join(...args);
    }
}
