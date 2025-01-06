import { _before, _toTitle } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { AbstractController as AbsCntrl } from '../AbstractController.js';
import { SocketEvent } from '../WebSocketWorker.js';
import { CookieStorage } from './CookieStorage.js';
import { SessionStorage } from './SessionStorage.js';
import { HttpEvent } from '../HttpEvent.js';
import { HttpUser } from '../HttpUser.js';
import { Workport } from './Workport.js';
import { Router } from './Router.js';
import { Url } from './Url.js';
import xfetch from '../xfetch.js';
import '../util-http.js';
import { WebSocketWorker } from '../WebSocketWorker.js';

const { Observer } = webqit;

export class AbstractController extends AbsCntrl {

	static get Router() { return Router; }

	static get HttpEvent() { return HttpEvent; }

	static get CookieStorage() { return CookieStorage; }

	static get SessionStorage() { return SessionStorage; }

    static get HttpUser() { return HttpUser; }

    static get Workport() { return Workport; }

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

	#workport;
	get workport() { return this.#workport; }

    constructor(host) {
        super();
        this.#host = host;
        Object.defineProperty(this.host, 'getWebfloControllerInstance', { value: () => this });
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
		this.#workport = new this.constructor.Workport;
        const getMessage = (e) => {
            let message = e.data;
            if (e.data?.message) {
                message = e.data.message + (e.data.description ? `\r\n${e.data.description}` : '');
            }
            return message;
        };
        this.#workport.handleMessages('alert', (e) => {
            alert(getMessage(e));
        });
        this.#workport.handleRequests('confirm', (e) => {
            return confirm(getMessage(e));
        });
        this.#workport.handleRequests('prompt', (e) => {
            return prompt(getMessage(e));
        });
        this.#workport.handleMessages('render', (e) => {
            const httpEvent = this.constructor.HttpEvent.create(null, { url: this.location.href });
            window.queueMicrotask(() => {
                this.render(httpEvent, e.data);
            });
        });
        const onlineHandler = () => Observer.set(this.network, 'status', window.navigator.onLine);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', onlineHandler);
        const uncontrols = this.control();
        return () => {
            this.#workport.close();
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', onlineHandler);
            uncontrols();
        };
    }

    controlClassic(locationCallback) {
        // -----------------------
        // Capture all link-clicks
        const clickHandler = (e) => {
            if (!this._canIntercept(e)) return;
            var anchorEl = e.target.closest('a');
            if (!anchorEl || !anchorEl.href || anchorEl.target || anchorEl.download || !this.isSpaRoute(anchorEl)) return;
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
            if (submitParams.target || !this.isSpaRoute(submitParams.action)) return;
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
            locationCallback(submitParams.action); // this
            this.navigate(
                submitParams.action,
                {
                    method: submitParams.method,
                    body: formData,
                    signal: this._abortController.signal,
                },
                detail,
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

    async redirect(location, backgroundActivity) {
        location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
        if (this.isSpaRoute(location)) {
            await this.navigate(location, {}, { navigationType: 'rdr' });
        } else this.hardRedirect(location, backgroundActivity);
    }

    hardRedirect(location, backgroundActivity) {
        if (backgroundActivity) {
            // Redundant as this is a window reload anyways
            backgroundActivity.close();
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
        // Ping any existing background process
        this.workport.postMessage('navigation');
        // Process request...
        scope.response = await new Promise(async (resolveResponse) => {
            scope.handleRespondWith = async (response) => {
                if (!(response instanceof Response)) {
                    response = Response.create(response);
                }
                resolveResponse(response);
            };
            // Create and route request
            scope.request = this.createRequest(scope.url, scope.init);
            scope.cookies = this.constructor.CookieStorage.create(scope.request);
            scope.session = this.constructor.SessionStorage.create(scope.request);
            scope.user = this.constructor.HttpUser.create(
                scope.request, 
                scope.session, 
                this.workport
            );
            scope.httpEvent = this.constructor.HttpEvent.create(scope.handleRespondWith, {
                request: scope.request,
                detail: scope.detail,
                cookies: scope.cookies,
                session: scope.session,
                user: scope.user,
                workport: this.workport
            });
            scope.httpEvent.onRequestClone = () => this.createRequest(scope.url, scope.init);
            // Ste pre-request states
            Observer.set(this.navigator, {
                requesting: new Url/*NOT URL*/(scope.url),
                origins: scope.detail.navigationOrigins || [],
                method: scope.request.method,
                error: null
            });
            scope.context = {};
            if (window.webqit?.oohtml?.configs) {
                const { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs;
                scope.context = this.host[bindingsConfig.bindings].data || {};
            }
            // Dispatch for response
            scope.$response = await this.dispatch(scope.httpEvent, scope.context, async (event) => {
                // Was this nexted()? Tell the next layer we're in JSON mode by default
                if (event !== scope.httpEvent && !event.request.headers.has('Accept')) {
                    event.request.headers.set('Accept', 'application/json');
                }
                return await this.remoteFetch(event.request);
            });
            // Handle background mode's final reponse
            if (scope.httpEvent.response) {
                const data = scope.$response instanceof Response
                    ? await scope.$response.parse()
                    : scope.$response;
                if (_isObject(data)) {
                    this.workport.dispatchEvent(new SocketEvent(
                        this.workport, //ownerAPI
                        null, // eventID
                        'render', // eventType
                        data,
                        0 // numPorts
                    ));
                }
                return;
            }
            resolveResponse(scope.$response);
        });
        scope.finalUrl = scope.response.url || scope.request.url;
        if (scope.response.redirected && scope.httpEvent.detail.navigationType !== 'traverse') {
            const stateData = { ...(this.currentEntry()?.getState() || {}), redirected: true, };
            await this.updateCurrentEntry({ state: stateData }, scope.finalUrl);    
        }
        if (scope.response.headers.has('X-Background-Activity')) {
            scope.backgroundActivity = this.handleBackgroundActivity(
                scope.response.headers.get('X-Background-Activity')
            );
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
                this.redirect(location, scope.backgroundActivity);
                if (scope.backgroundActivity) {
                    scope.backgroundActivity.addEventListener('render', () => {
                        // Set post-request states
                        Observer.set(this.navigator, {
                            requesting: null,
                            remotely: false,
                            origins: [],
                            method: null
                        });
                    });
                }
                return;
            }
        }
        // Only render now
        if ([202/*Accepted*/, 304/*Not Modified*/].includes(scope.response.status)) {
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
            await this.render(scope.httpEvent, scope.data);
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

    handleBackgroundActivity(uri) {
        const ws = new WebSocket(uri);
        const backgroundActivity = new WebSocketWorker(ws);
        this.#workport.add(backgroundActivity);
        return backgroundActivity;
    }

    async transitionUI(updateCallback) {
        if (document.startViewTransition) {
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

    async render(httpEvent, data) {
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
                    env: 'client',
                    navigator: this.navigator,
                    location: this.location,
                    network: this.network, // request, redirect, error, status, remote
                    transition: this.transition,
                    data: !_isObject(data) ? {} : data
                }, { diff: true });
            }
            if (modulesContextAttrs) {
                const newRoute = '/' + `routes/${this.location.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
                (this.host === window.document ? window.document.body : this.host).setAttribute(modulesContextAttrs.importscontext, newRoute);
            }
        });
    }
	
	async remoteFetch(request, ...args) {
		Observer.set(this.#navigator, 'remotely', true);
		const response = await xfetch(request, ...args);
		Observer.set(this.#navigator, 'remotely', false);
        return response;
	}
}