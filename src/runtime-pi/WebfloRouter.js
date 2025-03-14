import { _isString, _isFunction, _isArray } from '@webqit/util/js/index.js';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';

export class WebfloRouter {

	constructor(cx, path = []) {
        this.cx = cx;
        this.path = _isArray(path) ? path : (path + '').split('/').filter(a => a);
    }

    async route(method, event, arg = null, _default = null, remoteFetch = null, requestLifecycle = null) {

        const $this = this;
        const $runtime = this.cx.runtime;

        // ----------------
        // The loop
        // ----------------
        const next = async function(thisTick) {
            const thisContext = { runtime: $runtime };
            if (!thisTick.trail || thisTick.trail.length < thisTick.destination.length) {
                thisTick = await $this.readTick(thisTick);
                // -------------
                thisContext.pathname = `/${thisTick.trail.join('/')}`;
                thisContext.stepname = thisTick.trail[thisTick.trail.length - 1];
                $this.finalizeHandlerContext(thisContext, thisTick);
                // -------------
                if (thisTick.exports) {
                    // Broadcast any hints exported by handler
                    //@obsolete if (thisTick.exports.hints) { await event.port.post({ ...thisTick.exports.hints, $type: 'handler:hints' }); }
                    const methods = _arrFrom(thisTick.method).map(m => m === 'default' ? m : m.toUpperCase());
                    const handler = _isFunction(thisTick.exports) && methods.includes('default') ? thisTick.exports : methods.reduce((_handler, name) => _handler || thisTick.exports[name], null);
                    if (handler) {
                        // -------------
                        // Dynamic response
                        // -------------
                        const go = async (isFetch, ..._args) => {
                            const nextTick = { ...thisTick };
                            if (_args.length) {
                                let _url = _args[0], _request, requestInit = { ...(_args[1] || {}) };
                                if (_args[0] instanceof Request) {
                                    _request = _args[0];
                                    _url = _request.url;
                                } else if (isFetch) {
                                    // Fetch doesn't inherit the ongoing request
                                    requestInit = { method: 'GET', body: null, headers: {}, ...requestInit };
                                }
                                if (!_isString(_url)) {
                                    throw new Error('Router redirect url must be a string!');
                                }
                                if (/^http(s)?\:/i.test(_url)) {
                                    if (!isFetch) {
                                        throw new Error('The next() function doesn\'t accept remote URLs!');
                                    }
                                    return await remoteFetch(..._args);
                                }
                                let newDestination = _url.startsWith('/') ? _url : $this.pathJoin(`/${thisTick.trail.join('/')}`, _url);
                                if (newDestination.startsWith('../')) {
                                    throw new Error('Router redirect cannot traverse beyond the routing directory! (' + _url + ' >> ' + newDestination + ')');
                                }
                                if (requestInit.method) {
                                    nextTick.method = requestInit.method;
                                    if (_isArray(requestInit.method)) {
                                        requestInit.method = requestInit.method[0];
                                    }
                                } else if (_request) {
                                    nextTick.method = _request.method;
                                }
                                if (_request) {
                                    nextTick.event = await thisTick.event.with(newDestination, _request, requestInit);
                                } else {
                                    nextTick.event = await thisTick.event.with(newDestination, requestInit);
                                 }
                                nextTick.source = thisTick.destination.join('/');
                                nextTick.destination = newDestination.split('?').shift().split('/').map(a => a.trim()).filter(a => a);
                                nextTick.trail = _url.startsWith('/') ? [] : thisTick.trail.reduce((_commonRoot, _seg, i) => _commonRoot.length === i && _seg === nextTick.destination[i] ? _commonRoot.concat(_seg) : _commonRoot, []);
                                nextTick.trailOnFile = thisTick.trailOnFile.slice(0, nextTick.trail.length);
                            } else {
                                if (isFetch) {
                                    throw new Error('fetch() cannot be called without arguments!');
                                }
                                nextTick.event = thisTick.event.clone();
                            }
                            return next(nextTick);
                        };
                        // -------------
                        const _next = async (...args) => await go(false, ...args);
                        const nextPathname = thisTick.destination.slice(thisTick.trail.length);
                        _next.pathname = nextPathname.join('/');
                        _next.stepname = nextPathname[0];
                        // -------------
                        const _fetch = async (...args) => await go(true, ...args);
                        // -------------
                        return new Promise(async (res) => {
                            thisTick.event.onRespondWith = async (response) => {
                                thisTick.event.onRespondWith = null;
                                res(response);
                                await requestLifecycle.responsePromise;
                            };
                            const $returnValue = Promise.resolve(handler.call(thisContext, thisTick.event, _next/*next*/, _fetch/*fetch*/));
                            // This should listen first before waitUntil's listener
                            $returnValue.then(async (returnValue) => {
                                if (thisTick.event.onRespondWith) {
                                    thisTick.event.onRespondWith = null;
                                    res(returnValue);
                                } else if (typeof returnValue !== 'undefined') {
                                    await thisTick.event.respondWith(returnValue);
                                }
                            });
                            thisTick.event.waitUntil($returnValue);
                        });
                    }
                    // Handler not found but exports found
                    return next(thisTick);
                } else if ((thisTick.currentSegmentOnFile || {}).dirExists) {
                    // Exports not found but directory found
                    return next(thisTick);
                }
            }
            // -------------
            // Local file
            // -------------
            if (_default) {
                return await _default.call(thisContext, thisTick.event, remoteFetch);
            }
        };
        
        return next({
            destination: this.path,
            event,
            method
         });

    }
}
