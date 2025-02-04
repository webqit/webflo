import { _before, _toTitle } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { MultiportMessagingAPI } from '../MultiportMessagingAPI.js';
import { MessagingOverBroadcast } from '../MessagingOverBroadcast.js';
import { MessagingOverChannel } from '../MessagingOverChannel.js';
import { MessagingOverSocket } from '../MessagingOverSocket.js';
import { ClientMessaging } from './ClientMessaging.js';
import { CookieStorage } from './CookieStorage.js';
import { SessionStorage } from './SessionStorage.js';
import { HttpEvent } from '../HttpEvent.js';
import { HttpUser } from '../HttpUser.js';
import { Router } from './Router.js';
import { Url } from './Url.js';
import xfetch from '../xfetch.js';
import '../util-http.js';

const { Observer } = webqit;

export class WebfloClient extends WebfloRuntime {

	static get Router() { return Router; }

	static get HttpEvent() { return HttpEvent; }

	static get CookieStorage() { return CookieStorage; }

	static get SessionStorage() { return SessionStorage; }

    static get HttpUser() { return HttpUser; }

    #host;
    get host() { return this.#host; }

    #network;
    get network() { return this.#network; }

    #location;
    get location() { return this.#location; }

    #navigator;
    get navigator() { return this.#navigator; }

    #transition;
    get transition() { return this.#transition; }

	#backgroundMessaging;
	get backgroundMessaging() { return this.#backgroundMessaging; }

    get withViewTransitions() {
        return document.querySelector('meta[name="webflo-viewtransitions"]')?.value;
    }

    constructor(host) {
        super();
        this.#host = host;
        Object.defineProperty(this.host, 'webfloRuntime', { get: () => this });
        this.#network = { status: window.navigator.onLine };
        this.#location = new Url/*NOT URL*/(this.host.location);
        this.#navigator = {
            requesting: null,
            redirecting: null,
            remotely: false,
            origins: [],
            error: null,
        };
        this.#transition = {
            from: new Url/*NOT URL*/({}),
            to: new Url/*NOT URL*/(this.host.location),
            rel: 'unrelated',
            phase: 0
        };
    }

    initialize() {
		this.#backgroundMessaging = new MultiportMessagingAPI(this, { runtime: this });
        // Bind response and redirect handlers
        const responseHandler = (e) => {
            e.stopPropagation();
            if (e.type === 'response' && _isObject(e.data) && _isObject(e.data.status)) {
                e.originalTarget.fire('status', e.data.status);
            }
            setTimeout(() => {
                if (e.defaultPrevented || e.immediatePropagationStopped) return;
                window.queueMicrotask(() => {
                    if (e.type === 'response') {
                        const httpEvent = this.constructor.HttpEvent.create(null, { url: this.location.href });
                        this.render(httpEvent, e.data, true);
                    } else if (e.type === 'redirect') {
                        this.redirect(e.data);
                    }
                });
            }, 10);
        };
        this.backgroundMessaging.handleMessages('response', responseHandler);
        this.backgroundMessaging.handleMessages('redirect', responseHandler);
        // Bind network status handlers
        const onlineHandler = () => Observer.set(this.network, 'status', window.navigator.onLine);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', onlineHandler);
        // Start controlling
        const uncontrols = this.control();
        return () => {
            this.#backgroundMessaging.close();
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', onlineHandler);
            uncontrols();
        };
    }

    controlClassic(locationCallback) {
        const setStates = (url, detail, method = 'GET') => {
            Observer.set(this.navigator, {
                requesting: new Url/*NOT URL*/(url),
                origins: detail.navigationOrigins || [],
                method,
                error: null
            });
        };
        const resetStates = () => {
            Observer.set(this.navigator, {
                requesting: null,
                remotely: false,
                origins: [],
                method: null
            });
        };
        // -----------------------
        // Capture all link-clicks
        const clickHandler = (e) => {
            if (!this._canIntercept(e)) return;
            var anchorEl = e.target.closest('a');
            if (!anchorEl || !anchorEl.href || (anchorEl.target && !anchorEl.target.startsWith('_webflo:')) || anchorEl.download || !this.isSpaRoute(anchorEl)) return;
            const resolvedUrl = new URL(anchorEl.hasAttribute('href') ? anchorEl.getAttribute('href') : '', this.location.href);
            if (this.isHashChange(resolvedUrl)) {
                Observer.set(this.location, 'href', resolvedUrl.href);
                return;
            }
            // ---------------
            // Handle now
            e.preventDefault();
            this._abortController?.abort();
            this._abortController = new AbortController();
            // Note the order of calls below
            const detail = {
                navigationType: 'push',
                navigationOrigins: [anchorEl],
                destination: this._asEntry(null),
                source: this.currentEntry(), // this
                userInitiated: true,
            };

            if (anchorEl.target === '_webflo:_parent' && this.superRuntime) {
                setStates(resolvedUrl, detail);
                this.superRuntime.navigate(
                    resolvedUrl,
                    {
                        signal: this._abortController.signal,
                    },
                    {
                        ...detail,
                        isHoisted: true,
                    }
                ).then(resetStates);
                return;
            }
            locationCallback(resolvedUrl); // this
            this.navigate(
                resolvedUrl,
                {
                    signal: this._abortController.signal,
                },
                detail,
            ); // this
        };
        // -----------------------
        // Capture all form-submits
        const submitHandler = (e) => {
            if (!this._canIntercept(e)) return;
            // ---------------
            // Declare form submission modifyers
            const form = e.target.closest('form');
            const submitter = e.submitter;
            const _attr = (name) => {
                let value = submitter && submitter.hasAttribute(`form${name.toLowerCase()}`) ? submitter[`form${_toTitle(name)}`] : (form.getAttribute(name) || form[name]);
                if (value && [RadioNodeList, HTMLElement].some((x) => value instanceof x)) {
                    value = null;
                }
                return value;
            };
            const submitParams = Object.fromEntries(['method', 'action', 'enctype', 'noValidate', 'target'].map((name) => [name, _attr(name)]));
            submitParams.method = submitParams.method || submitter.dataset.formmethod || 'GET';
            submitParams.action = new URL(form.hasAttribute('action') ? form.getAttribute('action') : (
                submitter?.hasAttribute('formaction') ? submitter.getAttribute('formaction') : ''),
            this.location.href);
            if ((submitParams.target && !submitParams.target.startsWith('_webflo:')) || !this.isSpaRoute(submitParams.action)) return;
            // ---------------
            // Handle now
            let formData = new FormData(form);
            if ((submitter || {}).name) {
                formData.set(submitter.name, submitter.value);
            }
            if (submitParams.method.toUpperCase() === 'GET') {
                Array.from(formData.entries()).forEach((_entry) => {
                    submitParams.action.searchParams.set(_entry[0], _entry[1]);
                });
                formData = null;
            }
            if (this.isHashChange(submitParams.action) && submitParams.method.toUpperCase() !== 'POST') {
                Observer.set(this.location, 'href', submitParams.action.href);
                return;
            }
            e.preventDefault();
            this._abortController?.abort();
            this._abortController = new AbortController;
            // Note the order of calls below
            const detail = {
                navigationType: 'push',
                navigationOrigins: [submitter, form],
                destination: this._asEntry(null),
                source: this.currentEntry(), // this
                userInitiated: true,
            };
            if (submitParams.target === '_webflo:_parent' && this.superRuntime) {
                setStates(submitParams.action, detail, submitParams.method);
                this.superRuntime.navigate(
                    submitParams.action,
                    {
                        method: submitParams.method,
                        body: formData,
                        signal: this._abortController.signal,
                    },
                    {
                        ...detail,
                        isHoisted: true,
                    }
                ).then(resetStates);
                return;
            }
            locationCallback(submitParams.action); // this
            this.navigate(
                submitParams.action,
                {
                    method: submitParams.method,
                    body: formData,
                    signal: this._abortController.signal,
                },
                detail
            ); // this
        };
        this.host.addEventListener('click', clickHandler);
        this.host.addEventListener('submit', submitHandler);
        return () => {
            this.host.removeEventListener('click', clickHandler);
            this.host.removeEventListener('submit', submitHandler);
        };
    }

    _asEntry(state) { return { getState() { return state; } }; }

    _canIntercept(e) { return !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey); }

    _xRedirectCode = 200;

    isHashChange(urlObj) { return _before(this.location.href, '#') === _before(urlObj.href, '#') && (this.location.href.includes('#') || urlObj.href.includes('#')); }

    isSpaRoute(urlObj) {
        urlObj = typeof urlObj === 'string' ? new URL(urlObj, this.location.origin) : urlObj;
        if (urlObj.origin && urlObj.origin !== this.location.origin) return false;
        if (!this.cx.params.routing) return true;
        if (this.cx.params.routing.targets === false/** explicit false means disabled */) return false;
        let b = urlObj.pathname.split('/').filter(s => s);
        const match = a => {
            a = a.split('/').filter(s => s);
            return a.reduce((prev, s, i) => prev && (s === b[i] || [s, b[i]].includes('-')), true);
        };
        return match(this.cx.params.routing.root) && this.cx.params.routing.subroots.reduce((prev, subroot) => {
            return prev && !match(subroot);
        }, true);
    }

    async redirect(location, backgroundMessaging) {
        location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
        if (this.isSpaRoute(location)) {
            await this.navigate(location, {}, { navigationType: 'rdr' });
        } else this.hardRedirect(location, backgroundMessaging);
    }

    hardRedirect(location, backgroundMessaging) {
        if (backgroundMessaging) {
            // Redundant as this is a window reload anyways
            backgroundMessaging.close();
        }
        window.location = location;
    }

    createRequest(href, init = {}) {
        return new Request(href, {
            ...init,
            headers: {
                'Accept': 'application/json',
                'X-Redirect-Policy': 'manual-when-cross-spa',
                'X-Redirect-Code': this._xRedirectCode,
                'X-Powered-By': '@webqit/webflo',
                ...(init.headers || {}),
            },
        });
    }

    async navigate(url, init = {}, detail = {}) {
        // Resolve inputs
        const scope = { url, init, detail };
		if (typeof scope.url === 'string') {
			scope.url = new URL(scope.url, self.location.origin);
		}
        // ---------------
        // Event lifecycle
        scope.eventLifecyclePromises = new Set;
        scope.eventLifecycleHooks = {
            waitUntil: (promise) => {
                promise = Promise.resolve(promise);
                scope.eventLifecyclePromises.add(promise);
                scope.eventLifecyclePromises.dirty = true;
                promise.then(() => scope.eventLifecyclePromises.delete(promise));
            },
            respondWith: async (response) => {
                if (scope.eventLifecyclePromises.dirty && !scope.eventLifecyclePromises.size) {
                    throw new Error('Final response already sent');
                }
                return await this.execPush(scope.clientMessaging, response);
            },
        };
        // Create and route request
        scope.request = this.createRequest(scope.url, scope.init);
        scope.cookies = this.constructor.CookieStorage.create(scope.request);
        scope.session = this.constructor.SessionStorage.create(scope.request);
        const messageChannel = new MessageChannel;
        this.backgroundMessaging.add(new MessagingOverChannel(null, messageChannel.port1));
        scope.clientMessaging = new ClientMessaging(this, messageChannel.port2);
        scope.user = this.constructor.HttpUser.create(
            scope.request, 
            scope.session, 
            scope.clientMessaging
        );
        scope.httpEvent = this.constructor.HttpEvent.create(scope.eventLifecycleHooks, {
            request: scope.request,
            detail: scope.detail,
            cookies: scope.cookies,
            session: scope.session,
            user: scope.user,
            client: scope.clientMessaging
        });
        scope.httpEvent.onRequestClone = () => this.createRequest(scope.url, scope.init);
        // Ste pre-request states
        Observer.set(this.navigator, {
            requesting: new Url/*NOT URL*/(scope.url),
            origins: scope.detail.navigationOrigins || [],
            method: scope.request.method,
            error: null
        });
        scope.resetStates = () => {
            Observer.set(this.navigator, {
                requesting: null,
                remotely: false,
                origins: [],
                method: null
            });
        };
        scope.context = {};
        if (window.webqit?.oohtml?.configs) {
            const { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs;
            scope.context = this.host[bindingsConfig.bindings].data || {};
        }
        if (scope.request.method === 'GET') {
            // Ping any existing background process
            this.#backgroundMessaging.postMessage('navigation');
        }
        // Dispatch for response
        scope.response = await this.dispatch(scope.httpEvent, scope.context, async (event) => {
            // Was this nexted()? Tell the next layer we're in JSON mode by default
            if (event !== scope.httpEvent && !event.request.headers.has('Accept')) {
                event.request.headers.set('Accept', 'application/json');
            }
            return await this.remoteFetch(event.request);
        });
        // ---------------
        // Response processing
        scope.hasBackgroundActivity = scope.eventLifecyclePromises.size || (scope.redirectMessage && !(scope.response instanceof Response && scope.response.headers.get('Location')));
        scope.response = await this.normalizeResponse(scope.httpEvent, scope.response);
        if (scope.response.headers.get('Location')) {
            if (scope.redirectMessage) {
                scope.session.set(`redirect-message:${scope.redirectMessageID}`, scope.redirectMessage);
            }
		} else {
			if (scope.redirectMessage) {
                scope.eventLifecycleHooks.respondWith(scope.redirectMessage);
            }
		}
        Promise.all([...scope.eventLifecyclePromises]).then(() => {
            if (scope.clientMessaging.isMessaging()) {
                scope.clientMessaging.on('connected', () => {
                    setTimeout(() => {
                        scope.clientMessaging.close();
                    }, 100);
                });
            } else scope.clientMessaging.close();
        });
        // ---------------
        // Decode response
        scope.finalUrl = scope.response.url || scope.request.url;
        if (scope.response.redirected || scope.detail.navigationType === 'rdr' || scope.detail.isHoisted) {
            const stateData = { ...(this.currentEntry()?.getState() || {}), redirected: true, };
            await this.updateCurrentEntry({ state: stateData }, scope.finalUrl);    
        }
        if (scope.response.headers.has('X-Background-Messaging')) {
            scope.backgroundMessaging = this.$createBackgroundMessagingFrom(
                scope.response.headers.get('X-Background-Messaging')
            );
            this.backgroundMessaging.add(scope.backgroundMessaging);
        }
        if (scope.response.headers.has('Location')) {
            // Normalize redirect
            const xActualRedirectCode = parseInt(scope.response.headers.get('X-Redirect-Code'));
            if (xActualRedirectCode && scope.response.status === this._xRedirectCode) {
                scope.response.meta.status = xActualRedirectCode; // @NOTE 1
            }
            // Trigger redirect
            if ([302, 301].includes(scope.response.status)) {
                const location = scope.response.headers.get('Location');
                this.redirect(location, scope.backgroundMessaging);
                if (scope.backgroundMessaging) {
                    scope.backgroundMessaging.addEventListener('response', () => {
                        scope.resetStates();
                    });
                }
                return;
            }
        }
        // Only render now
        if ([202/*Accepted*/, 304/*Not Modified*/].includes(scope.response.status)) {
            if (scope.backgroundMessaging) {
                scope.backgroundMessaging.addEventListener('response', () => {
                    scope.resetStates();
                });
                return;
            }
            scope.data = scope.context;
        } else {
            scope.data = await scope.response.parse() || {};
        }
        // Transition UI
        Observer.set(this.transition.from, Url.copy(this.location));
        Observer.set(this.transition.to, 'href', scope.finalUrl);
        Observer.set(this.transition, 'rel', this.transition.from.pathname === this.transition.to.pathname ? 'unchanged' : (`${this.transition.from.pathname}/`.startsWith(`${this.transition.to.pathname}/`) ? 'parent' : (`${this.transition.to.pathname}/`.startsWith(`${this.transition.from.pathname}/`) ? 'child' : 'unrelated')));
        await this.transitionUI(async () => {
            Observer.set(this.location, 'href', scope.finalUrl);
            // Set post-request states
            Observer.set(this.navigator, {
                requesting: null,
                remotely: false,
                origins: [],
                method: null
            });
            // Error?
            if ([404, 500].includes(scope.response.status)) {
                const error = new Error(scope.response.statusText, { code: scope.response.status });
                Object.defineProperty(error, 'retry', { value: async () => await this.navigate(scope.url, scope.init, scope.detail) });
                Observer.set(this.navigator, 'error', error);
            }
            if (_isObject(scope.data) && _isObject(scope.data.status)) {
                scope.httpEvent.client.postMessage(scope.data.status, { messageType: 'status' });
            }
            await this.render(scope.httpEvent, scope.data, !(['GET'].includes(scope.request.method) || scope.response.redirected || scope.detail.navigationType === 'rdr'));
            await this.applyPostRenderState(scope.httpEvent);
        });
    }

    async dispatch(httpEvent, context, crossLayerFetch, processObj = {}) {
        const response = await super.dispatch(httpEvent, context, crossLayerFetch);
        // Handle "retry" directives
        if (response.headers.has('Retry-After')) {
            if (!processObj.recurseController) {
                // This is start of the process
                processObj.recurseController = new AbortController;
            }
            // Ensure a previous recursion hasn't aborted the process
            if (!processObj.recurseController.signal.aborted) {
                await new Promise((res) => setTimeout(res, parseInt(response.headers.get('Retry-After')) * 1000));
                const eventClone = httpEvent.clone();
                return await this.dispatch(eventClone, context, crossLayerFetch, processObj);
            }
        } else if (processObj.recurseController) {
            // Abort the signal. This is the end of the process
            processObj.recurseController.abort();
        }
        return response;
    }

    $createBackgroundMessagingFrom(uri) {
        const [proto, portID] = uri.split(':');
        let instance;
        if (proto === 'ch') {
            instance = new MessagingOverBroadcast(null, portID);
        } else {
            instance = new MessagingOverSocket(null, portID);
        }
        return instance;
    }

    async transitionUI(updateCallback) {
        if (document.startViewTransition && this.withViewTransitions) {
            const synthesizeWhile = window.webqit?.realdom?.synthesizeWhile || ((callback) => callback());
            await synthesizeWhile(async () => {
                Observer.set(this.transition, 'phase', 1);
                const viewTransition = document.startViewTransition(updateCallback);
                try { await viewTransition.updateCallbackDone; } catch (e) { console.log(e); }
                Observer.set(this.transition, 'phase', 2);
                try { await viewTransition.ready; } catch (e) { console.log(e); }
                Observer.set(this.transition, 'phase', 3);
                try { await viewTransition.finished; } catch (e) { console.log(e); }
                Observer.set(this.transition, 'phase', 0);
            });
        } else await updateCallback();
    }

    async render(httpEvent, data, merge = false) {
        const router = new this.constructor.Router(this.cx, this.location.pathname);
        await router.route('render', httpEvent, data, async (httpEvent, data) => {
            if (!window.webqit?.oohtml?.configs) return;
            if (window.webqit?.dom) {
                await new Promise(res => window.webqit.dom.ready(res));
            }
            const {
                BINDINGS_API: { api: bindingsConfig } = {},
                HTML_IMPORTS: { attr: modulesContextAttrs } = {},
            } = window.webqit.oohtml.configs;
            if (bindingsConfig) {
                this.host[bindingsConfig.bind]({
                    state: {},
                    ...(!_isObject(data) ? {} : data),
                    env: 'client',
                    navigator: this.navigator,
                    location: this.location,
                    network: this.network, // request, redirect, error, status, remote
                    transition: this.transition,
                    background: null
                }, { diff: true, merge });
                let overridenKeys;
                if (_isObject(data) && (overridenKeys = ['env', 'navigator', 'location', 'network', 'transition', 'background'].filter((k) => k in data)).length) {
                    console.error(`The following data properties were overridden: ${overridenKeys.join(', ')}`);
                }
            }
            if (modulesContextAttrs) {
                const newRoute = '/' + `routes/${this.location.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                (this.host === window.document ? window.document.body : this.host).setAttribute(modulesContextAttrs.importscontext, newRoute);
            }
        });
    }

	async applyPostRenderState(httpEvent) {
		if (!httpEvent.url.hash && httpEvent.detail.navigationType !== 'traverse' && httpEvent.request.method === 'GET') {
			(this.host === document ? window : this.host).scrollTo(0, 0);
		}
	}
	
	async remoteFetch(request, ...args) {
		Observer.set(this.#navigator, 'remotely', true);
		const response = await xfetch(request, ...args);
		Observer.set(this.#navigator, 'remotely', false);
        return response;
	}
}