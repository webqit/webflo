import { _before, _toTitle } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { Observer } from '@webqit/quantum-js';
import { WebfloRuntime } from '../WebfloRuntime.js';
import { meta, createBackgroundMessagingPort } from '../webflo-fetch/util.js';
import { MultiportMessagingAPI } from '../webflo-messaging/MultiportMessagingAPI.js';
import { MessagingOverChannel } from '../webflo-messaging/MessagingOverChannel.js';
import { ClientMessagingPort } from './ClientMessagingPort.js';
import { ClientSideCookies } from './ClientSideCookies.js';
import { HttpSession } from '../webflo-routing/HttpSession.js';
import { HttpEvent } from '../webflo-routing/HttpEvent.js';
import { HttpUser } from '../webflo-routing/HttpUser.js';
import { Url } from '../webflo-url/Url.js';
import '../webflo-fetch/index.js';
import '../webflo-url/index.js';

export class WebfloClient extends WebfloRuntime {

    static get HttpEvent() { return HttpEvent; }

    static get HttpCookies() { return ClientSideCookies; }

    static get HttpSession() { return HttpSession; }

    static get HttpUser() { return HttpUser; }

    #host;
    get host() { return this.#host; }

    #location;
    get location() { return this.#location; }

    #navigator;
    get navigator() { return this.#navigator; }

    #transition;
    get transition() { return this.#transition; }

    #backgroundMessagingPorts;
    get backgroundMessagingPorts() { return this.#backgroundMessagingPorts; }

    #sdk = {};
    get sdk() { return this.#sdk; }

    get isClientSide() { return true; }

    constructor(cx, host) {
        super(cx);
        this.#host = host;
        Object.defineProperty(this.host, 'webfloRuntime', { get: () => this });
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
        this.#backgroundMessagingPorts = new MultiportMessagingAPI(this, { runtime: this });
    }

    async initialize() {
        const instanceController = await super.initialize();
        // Bind prompt handlers
        const promptsHandler = (e) => {
            const message = e.data?.message
                ? e.data.message + (e.data.details ? `\r\n${e.data.details}` : '')
                : e.data;
            const execPromp = () => {
                if (e.type === 'confirm') {
                    e.respondWith(confirm(message));
                } else if (e.type === 'prompt') {
                    e.respondWith(prompt(message));
                }
            };
            window.queueMicrotask(execPromp);
        };
        this.backgroundMessagingPorts.handleMessages('confirm', promptsHandler, { signal: instanceController.signal });
        this.backgroundMessagingPorts.handleMessages('prompt', promptsHandler, { signal: instanceController.signal });
        await this.hydrate();
        this.control();
        return instanceController;
    }

    controlSuper() {
        return super.control();
    }

    controlClassic(locationCallback) {
        const instanceController = super.control();
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
            if (!this._canIntercept(e) || e.defaultPrevented) return;
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
                this.superRuntime.navigate(resolvedUrl, {}, {
                    ...detail,
                    isHoisted: true,
                }).then(resetStates);
                return;
            }
            locationCallback(resolvedUrl); // this
            this.navigate(resolvedUrl, {}, detail); // this
        };
        // -----------------------
        // Capture all form-submits
        const submitHandler = (e) => {
            if (!this._canIntercept(e) || e.defaultPrevented) return;
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
                },
                detail
            ); // this
        };
        this.host.addEventListener('click', clickHandler, { signal: instanceController.signal });
        this.host.addEventListener('submit', submitHandler, { signal: instanceController.signal });
        return instanceController;
    }

    _asEntry(state) { return { getState() { return state; } }; }

    _canIntercept(e) { return !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey); }

    #xRedirectCode = 200;

    isHashChange(urlObj) { return _before(this.location.href, '#') === _before(urlObj.href, '#') && (this.location.href.includes('#') || urlObj.href.includes('#')); }

    isSpaRoute(urlObj) {
        urlObj = typeof urlObj === 'string' ? new URL(urlObj, this.location.origin) : urlObj;
        if (urlObj.origin && urlObj.origin !== this.location.origin) return false;
        let b = urlObj.pathname.split('/').filter(s => s);
        const match = a => {
            a = a.split('/').filter(s => s);
            return a.reduce((prev, s, i) => prev && (s === b[i] || [s, b[i]].includes('-')), true);
        };
        return match(this.routes.$root) && this.routes.$sparoots.reduce((prev, subroot) => {
            return prev && !match(subroot);
        }, true);
    }

    #prevEvent;
    createHttpEvent(init, singleton = true) {
        if (singleton && this.#prevEvent) {
            this.#prevEvent.abort();
        }
        const httpEvent = super.createHttpEvent(init);
        this.$instanceController.signal.addEventListener('abort', () => httpEvent.abort(), { once: true });
        return this.#prevEvent = httpEvent;
    }

    createRequest(href, init = {}) {
        const request = super.createRequest(href, init);
        request.headers.set('Accept', 'application/json');
        request.headers.set('X-Redirect-Policy', 'manual-when-cross-spa');
        request.headers.set('X-Redirect-Code', this.#xRedirectCode);
        request.headers.set('X-Powered-By', '@webqit/webflo');
        return request;
    }

    async navigate(url, init = {}, detail = {}) {
        // Resolve inputs
        const scopeObj = { url, init, detail };
        if (typeof scopeObj.url === 'string') {
            scopeObj.url = new URL(scopeObj.url, self.location.origin);
        }
        // Create and route request
        scopeObj.request = this.createRequest(scopeObj.url, scopeObj.init);
        scopeObj.cookies = this.createHttpCookies({
            request: scopeObj.request
        });
        scopeObj.session = this.createHttpSession({
			store: this.#sdk.storage?.('session'),
			request: scopeObj.request
		});
        const messageChannel = new MessageChannel;
        scopeObj.clientMessagingPort = new ClientMessagingPort(null, messageChannel.port2, { isPrimary: true, honourDoneMutationFlags: true });
        scopeObj.user = this.createHttpUser({
            store: this.#sdk.storage?.('user'),
            request: scopeObj.request,
            session: scopeObj.session,
            client: scopeObj.clientMessagingPort,
        });
        if (window.webqit?.oohtml?.configs) {
            const { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs;
            scopeObj.UIState = (this.host[bindingsConfig.bindings] || {}).state;
        }
        scopeObj.httpEvent = this.createHttpEvent({
            request: scopeObj.request,
            cookies: scopeObj.cookies,
            session: scopeObj.session,
            user: scopeObj.user,
            client: scopeObj.clientMessagingPort,
            sdk: this.#sdk,
            detail: scopeObj.detail,
            signal: init.signal,
            state: scopeObj.UIState,
        }, true);
        // Set pre-request states
        Observer.set(this.navigator, {
            requesting: new Url/*NOT URL*/(scopeObj.url),
            origins: scopeObj.detail.navigationOrigins || [],
            method: scopeObj.request.method,
            error: null
        });
        scopeObj.resetStates = () => {
            Observer.set(this.navigator, {
                requesting: null,
                remotely: false,
                origins: [],
                method: null
            });
        };
        // Ping existing background processes
        if (scopeObj.request.method === 'GET' || (scopeObj.request.method === 'POST' && scopeObj.url.pathname !== this.location.pathname)) {
            // !IMPORTANT: Posting to the group when empty will keep the event until next addition
            // and we don't want that
            if (this.#backgroundMessagingPorts.ports.size) {
                const url = { ...Url.copy(scopeObj.url), method: scopeObj.request.method };
                this.#backgroundMessagingPorts.postMessage(url, { eventOptions: { type: 'navigate' } });
            }
        }
        // Dispatch for response
        const backgroundMessagingPortCallback = () => new MessagingOverChannel(null, messageChannel.port1, { honourDoneMutationFlags: true });
        scopeObj.response = await this.dispatchNavigationEvent({
            httpEvent: scopeObj.httpEvent,
            crossLayerFetch: async (event) => {
                // Was this nexted()? Tell the next layer we're in JSON mode by default
                if (event !== scopeObj.httpEvent && !event.request.headers.has('Accept')) {
                    event.request.headers.set('Accept', 'application/json');
                }
                return await this.remoteFetch(event.request);
            },
            backgroundMessagingPort: backgroundMessagingPortCallback,
            originalRequestInit: scopeObj.init
        });
        if (scopeObj.response.isLive()) {
            this.backgroundMessagingPorts.add(scopeObj.response.backgroundMessagingPort);
        }
        // ---------------
        // Decode response
        scopeObj.finalUrl = scopeObj.response.url || scopeObj.request.url;
        if (scopeObj.response.redirected || scopeObj.detail.navigationType === 'rdr' || scopeObj.detail.isHoisted) {
            const stateData = { ...(this.currentEntry()?.getState() || {}), redirected: true, };
            await this.updateCurrentEntry({ state: stateData }, scopeObj.finalUrl);
        }
        // Handle no-render scenarios 2
        if ([202, 304].includes(scopeObj.response.status)) {
            scopeObj.notModified = true;
            if (scopeObj.response.backgroundMessagingPort) {
                scopeObj.response.backgroundMessagingPort.addEventListener(
                    'response.replace', 
                    () => scopeObj.resetStates(), 
                    { once: true, signal: httpEvent.signal }
                );
                return;
            }
        }
        // Handle no-render scenarios 1
        if (scopeObj.response.headers.get('Location') && this.processRedirect(scopeObj.response)) {
            if (scopeObj.response.backgroundMessagingPort) {
                scopeObj.response.backgroundMessagingPort.addEventListener(
                    'response.replace', 
                    () => scopeObj.resetStates(), 
                    { once: true, signal: httpEvent.signal }
                );
            }
            return;
        }
        // ---------------
        // Transition UI
        Observer.set(this.transition.from, Url.copy(this.location));
        Observer.set(this.transition.to, 'href', scopeObj.finalUrl);
        Observer.set(this.transition, 'rel', this.transition.from.pathname === this.transition.to.pathname ? 'unchanged' : (
            `${this.transition.from.pathname}/`.startsWith(`${this.transition.to.pathname}/`) ? 'parent' : (
                `${this.transition.to.pathname}/`.startsWith(`${this.transition.from.pathname}/`) ? 'child' : 'unrelated'
            )
        ));
        await this.transitionUI(async () => {
            // Set post-request states
            Observer.set(this.location, 'href', scopeObj.finalUrl);
            scopeObj.resetStates();
            // Error?
            if ([404, 500].includes(scopeObj.response.status)) {
                const error = new Error(scopeObj.response.statusText, { code: scopeObj.response.status });
                Object.defineProperty(error, 'retry', { value: async () => await this.navigate(scopeObj.url, scopeObj.init, scopeObj.detail) });
                Observer.set(this.navigator, 'error', error);
            }
            // Render response?
            if (!scopeObj.notModified) {
                await this.render(
                    scopeObj.httpEvent,
                    scopeObj.response,
                    !(['GET'].includes(scopeObj.request.method) || scopeObj.response.redirected || scopeObj.detail.navigationType === 'rdr')
                );
                await this.applyPostRenderState(scopeObj.httpEvent);
            }
        });
    }

    async dispatchNavigationEvent({ httpEvent, crossLayerFetch, backgroundMessagingPort, originalRequestInit, processObj = {} }) {
        const response = await super.dispatchNavigationEvent({ httpEvent, crossLayerFetch, backgroundMessagingPort });
        // Handle "retry" directives
        if (response.headers.has('Retry-After')) {
            if (!processObj.recurseController) {
                // This is start of the process
                processObj.recurseController = new AbortController;
                httpEvent.signal.addEventListener('abort', () => processObj.recurseController.abort(), { once: true });
            }
            // Ensure a previous recursion hasn't aborted the process
            if (!processObj.recurseController.signal.aborted) {
                await new Promise((res) => setTimeout(res, parseInt(response.headers.get('Retry-After')) * 1000));
                const eventClone = httpEvent.cloneWith({ request: this.createRequest(httpEvent.url, originalRequestInit) });
                return await this.dispatchNavigationEvent({ httpEvent: eventClone, crossLayerFetch, backgroundMessagingPort, originalRequestInit, processObj });
            }
        } else if (processObj.recurseController) {
            // Abort the signal. This is the end of the loop
            processObj.recurseController.abort();
        }
        return response;
    }

    processRedirect(response) {
        // Normalize redirect
        const xActualRedirectCode = parseInt(response.headers.get('X-Redirect-Code'));
        if (xActualRedirectCode && response.status === this.#xRedirectCode) {
            response[meta].status = xActualRedirectCode; // @NOTE 1
        }
        // Trigger redirect
        if ([302, 301].includes(response.status)) {
            const location = new URL(response.headers.get('Location'), this.location.origin);
            if (this.isSpaRoute(location)) {
                this.navigate(location, {}, { navigationType: 'rdr' });
            } else {
                this.redirect(location, response.backgroundMessagingPort);
            }
            return true;
        }
    }

    redirect(location, backgroundMessagingPort) {
        if (backgroundMessagingPort) {
            // Redundant as this is a window reload anyways
            backgroundMessagingPort.close();
        }
        window.location = location;
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

    async render(httpEvent, response, merge = false) {
        const router = new this.constructor.Router(this, this.location.pathname);
        await router.route('render', httpEvent, async (httpEvent) => {
            if (!window.webqit?.oohtml?.configs) return;
            if (window.webqit?.dom) {
                await new Promise(res => window.webqit.dom.ready(res));
            }
            const {
                BINDINGS_API: { api: bindingsConfig } = {},
                HTML_IMPORTS: { attr: modulesContextAttrs } = {},
            } = window.webqit.oohtml.configs;
            if (bindingsConfig) {
                const $response = await LiveResponse.from(response);
                this.host[bindingsConfig.bind]({
                    state: {},
                    data: $response.body,
                    env: 'client',
                    navigator: this.navigator,
                    location: this.location,
                    network: this.network, // request, redirect, error, status, remote
                    capabilities: this.capabilities,
                    transition: this.transition,
                }, { diff: true, merge });
                $response.addEventListener('replace', (e) => {
                    if ($response.headers.get('Location') && this.processRedirect($response)) return;
                    this.host[bindingsConfig.bindings].data = $response.body;
                });
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
        const response = await fetch(request, ...args);
        Observer.set(this.#navigator, 'remotely', false);
        return response;
    }
}