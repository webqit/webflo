import { _isFunction, _isArray, _isObject } from '@webqit/util/js/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';
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
                    if (_default) {
                        return await _default.call(thisContext, thisTick.event, remoteFetch);
                    }
                    return;
                }
                // -------------
                // Broadcast any hints exported by handler
                //@obsolete if (thisTick.exports.hints) { await event.port.post({ ...thisTick.exports.hints, $type: 'handler:hints' }); }
                const methods = _arrFrom(thisTick.method).map(m => m === 'default' ? m : m.toUpperCase());
                const handler = _isFunction(thisTick.exports) && methods.includes('default') ? thisTick.exports : methods.reduce((_handler, name) => _handler || thisTick.exports[name], null);
                if (!handler) {
                    // Handler not found but exports found
                    return next(thisTick);
                }
                // -------------
                // Handler found
                // -------------
                const go = async (isFetch, ...args) => {
                    const nextTick = { ...thisTick };
                    if (args.length) {
                        const url = args[0] instanceof Request ? args[0].url : (
                            !isFetch && _isObject(args[0]) ? args[0].redirect : args[0]
                        );
                        if (typeof url !== 'string') {
                            throw new Error('Router redirect url must be a string!');
                        }
                        // Handle absolute URLs
                        if (/^http(s)?\:/i.test(url)) {
                            if (!isFetch) {
                                throw new Error('The next() function doesn\'t accept remote URLs!');
                            }
                            return await remoteFetch(...args);
                        }
                        // Continue for relative URLs
                        let resolvedRelativeUrl = url;
                        if (!url.startsWith('/')) {
                            resolvedRelativeUrl = $this.pathJoin(`/${thisTick.trail.join('/')}`, url);
                            if (resolvedUrl.startsWith('../')) {
                                throw new Error('Router redirect cannot traverse beyond the routing directory! (' + url + ' >> ' + resolvedUrl + ')');
                            }
                        }
                        // Build request inheritance chain
                        const requestInheritanceChain = [new URL(resolvedRelativeUrl, thisTick.event.url.origin)];
                        if (!isFetch && thisTick.event.request instanceof Request) {
                            const { url: _, ...init } = await Request.copy(thisTick.event.request);
                            requestInheritanceChain.push(init);
                        }
                        if (args[0] instanceof Request) {
                            const { url: _, ...init } = await Request.copy(args[0]);
                            requestInheritanceChain.push(init);
                        } else if (!isFetch && _isObject(args[0].with)) {
                            requestInheritanceChain.push(args[0].with);
                        }
                        if (_isObject(args[1])) {
                            requestInheritanceChain.push(args[1]);
                        }
                        // Compose new event parameters
                        const request = requestInheritanceChain.reduce((prev, curr = {}) => new Request(prev, curr), requestInheritanceChain.shift());
                        // Set context parameters
                        nextTick.method = request.method;
                        nextTick.event = await thisTick.event.extend({ request });
                        nextTick.source = thisTick.destination.join('/');
                        nextTick.destination = resolvedRelativeUrl.split('?').shift().split('/').map(a => a.trim()).filter(a => a);
                        nextTick.trail = url.startsWith('/') ? [] : thisTick.trail.reduce((_commonRoot, _seg, i) => _commonRoot.length === i && _seg === nextTick.destination[i] ? _commonRoot.concat(_seg) : _commonRoot, []);
                        nextTick.trailOnFile = thisTick.trailOnFile.slice(0, nextTick.trail.length);
                    } else {
                        if (isFetch) {
                            throw new Error('fetch() cannot be called without arguments!');
                        }
                        nextTick.event = thisTick.event.extend();
                    }
                    return next(nextTick);
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
                    thisTick.event.internalLiveResponse.addEventListener('replace', () => {
                        if (!resolved) {
                            resolved = 1;
                            resolve(thisTick.event.internalLiveResponse);
                        } else if (resolved === 2) {
                            throw new Error(`Unexpected respondWith() after handler returns.`);
                        }
                    });
                    const returnValue = await handler.call(thisContext, thisTick.event, $next/*next*/, $fetch/*fetch*/);
                    if (!resolved) {
                        resolved = 2;
                        resolve(returnValue);
                    } else if (typeof returnValue !== 'undefined') {
                        await thisTick.event.internalLiveResponse.replaceWith(returnValue, { done: true });
                    }
                });
             }
            if (_default) {
                return await _default.call(thisContext, thisTick.event, remoteFetch);
            }
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
