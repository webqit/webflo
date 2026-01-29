import { _before, _toTitle } from '@webqit/util/str/index.js';
import { Observer } from '@webqit/observer';
import { URLPlus } from '@webqit/url-plus';
import { StarPort } from '@webqit/port-plus';
import { LiveResponse, RequestPlus } from '@webqit/fetch-plus';
import { HttpThread111 } from '../webflo-routing/HttpThread111.js';
import { HttpCookies101 } from '../webflo-routing/HttpCookies101.js';
import { HttpCookies110 } from '../webflo-routing/HttpCookies110.js';
import { HttpSession110 } from '../webflo-routing/HttpSession110.js';
import { HttpUser111 } from '../webflo-routing/HttpUser111.js';
import { HttpEvent111 } from '../webflo-routing/HttpEvent111.js';
import { WebfloRouter111 } from '../webflo-routing/WebfloRouter111.js';
import { KeyvalsFactory110 } from '../webflo-routing/KeyvalsFactory110.js';
import { ClientRequestPort100 } from '../webflo-messaging/ClientRequestPort100.js';
import { AppRuntime } from '../AppRuntime.js';
import { _meta } from '../../util.js';

export class WebfloClient extends AppRuntime {

    #keyvals;
    get keyvals() { return this.#keyvals; }

    #host;
    get host() { return this.#host; }

    #location;
    get location() { return this.#location; }

    #navigator;
    get navigator() { return this.#navigator; }

    #transition;
    get transition() { return this.#transition; }

    #background;
    get background() { return this.#background; }

    #viewport;
    get viewport() { return this.#viewport; }

    get isClientSide() { return true; }

    constructor(bootstrap, host) {
        super(bootstrap);
        this.#host = host;
        Object.defineProperty(this.host, 'webfloRuntime', { get: () => this });
        this.#location = new URLPlus(this.host.location);
        this.#navigator = {
            requesting: null,
            redirecting: null,
            remotely: false,
            origins: [],
            error: null,
        };
        this.#transition = {
            from: new URLPlus(window.origin),
            to: new URLPlus(this.host.location),
            rel: 'unrelated',
            phase: 0
        };
        this.#background = new StarPort({ handshake: 1, autoClose: false });

        // ---------------------
        // Dynamic viewport styling

        const oskToken = 'interactive-widget=resizes-content';
        const hasOsk = (content) => content?.includes(oskToken);
        const removeOsk = (content) => {
            if (content?.includes('interactive-widget')) {
                return content
                    .split(',')
                    .filter((s) => !s.includes('interactive-widget'))
                    .map((s) => s.trim())
                    .join(', ');
            }
            return content;
        };
        const addOsk = (content) => {
            if (content?.includes('interactive-widget')) {
                return content
                    .split(',')
                    .map((s) => s.includes('interactive-widget') ? oskToken : s.trim())
                    .join(', ');
            }
            return content + ', ' + oskToken;
        };

        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const viewportMetaInitialContent = viewportMeta?.content;
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const renderViewportMetas = (entry) => {
            viewportMeta?.setAttribute('content', entry.osk ? addOsk(viewportMetaInitialContent) : removeOsk(viewportMetaInitialContent));
            themeColorMeta?.setAttribute('content', entry.themeColor);
        };

        const initial = {
            themeColor: themeColorMeta?.content,
            osk: hasOsk(viewportMetaInitialContent),
        };
        const viewportStack = [initial];

        this.#viewport = {
            push(entryId, { themeColor = viewportStack[0].themeColor, osk = viewportStack[0].osk }) {
                if (typeof entryId !== 'string' || !entryId?.trim()) {
                    throw new Error('entryId cannot be ommited');
                }
                if (viewportStack.find((e) => e.entryId === entryId)) return;
                viewportStack.unshift({ entryId, themeColor, osk });
                renderViewportMetas(viewportStack[0]);
            },
            pop(entryId) {
                if (typeof entryId !== 'string' || !entryId?.trim()) {
                    throw new Error('entryId cannot be ommited');
                }
                const index = viewportStack.findIndex((e) => e.entryId === entryId);
                if (index === -1) return;
                viewportStack.splice(index, 1);
                renderViewportMetas(viewportStack[0]);
            },
            current() {
                return viewportStack[0];
            }
        };
    }

    async initialize() {
        // ----------
        // The keyvals API
        this.#keyvals = new KeyvalsFactory110;

        // ----------
        // Call default-init
        const instanceController = await super.initialize();

        // ----------
        // Bind prompt handlers
        const dialogHandler = (e) => {
            window.queueMicrotask(() => {
                if (e.defaultPrevented) return;

                if (e.type === 'confirm') {
                    const dialogElement = document.createElement('wq-confirm');
                    dialogElement.toggleAttribute('wq-default', true);

                    dialogElement.render(e.data);
                    document.body.append(dialogElement);
                    dialogElement.showPopover();

                    dialogElement.addEventListener('response', (r) => {
                        e.respondWith(r.data);
                        setTimeout(() => dialogElement.remove(), 300);
                    }, { once: true });
                } else if (e.type === 'prompt') {
                    const dialogElement = document.createElement('wq-prompt');
                    dialogElement.toggleAttribute('wq-default', true);

                    dialogElement.render(e.data);
                    document.body.append(dialogElement);
                    dialogElement.showPopover();

                    dialogElement.addEventListener('response', (r) => {
                        e.respondWith(r.data);
                        setTimeout(() => dialogElement.remove(), 300);
                    }, { once: true });
                } else if (e.type === 'status') {
                    const dialogElement = document.createElement('wq-toast');
                    dialogElement.toggleAttribute('wq-default', true);

                    dialogElement.render(e.data);
                    document.body.append(dialogElement);
                    dialogElement.showPopover();

                    dialogElement.addEventListener('toggle', (t) => {
                        if (t.newState !== 'closed') return;
                        dialogElement.remove();
                    }, { once: true });
                }
            });
        };
        this.background.addEventListener('confirm', dialogHandler, { signal: instanceController.signal });
        this.background.addEventListener('prompt', dialogHandler, { signal: instanceController.signal });
        this.background.addEventListener('status', dialogHandler, { signal: instanceController.signal });

        // ----------
        // Call default-init
        await this.setupCapabilities();
        this.control();
        await this.hydrate();

        return instanceController;
    }

    controlSuper() {
        return super.control();
    }

    controlClassic(locationCallback) {
        const instanceController = super.control();
        const setStates = (url, detail, method = 'GET') => {
            Observer.set(this.navigator, {
                requesting: new URL(url),
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

    isHashChange(urlObj) { return _before(this.location.href, '#') === _before(urlObj.href, '#') && (this.location.href.includes('#') || urlObj.href.includes('#')); }

    isSpaRoute(urlObj) {
        urlObj = typeof urlObj === 'string' ? new URL(urlObj, this.location.origin) : urlObj;
        if (urlObj.origin && urlObj.origin !== this.location.origin) return false;
        let b = urlObj.pathname.split('/').filter(s => s);
        const match = a => {
            a = a.split('/').filter(s => s);
            return a.reduce((prev, s, i) => prev && (s === b[i] || [s, b[i]].includes('-')), true);
        };
        return match(this.bootstrap.$root) && this.bootstrap.$sparoots.reduce((prev, subroot) => {
            return prev && !match(subroot);
        }, true);
    }

    #prevEvent;
    createHttpEvent111(init, singleton = true) {
        if (singleton && this.#prevEvent) {
            // TODO
            //this.#prevEvent.abort();
        }
        const httpEvent = super.createHttpEvent111(init);
        this.$instanceController.signal.addEventListener('abort', () => httpEvent.abort(), { once: true });
        return this.#prevEvent = httpEvent;
    }

    createRequest(href, init = {}) {
        const request = super.createRequest(href, init);
        request.headers.set('Accept', 'application/json');
        request.headers.set('X-Redirect-Policy', 'manual-when-cross-spa');
        request.headers.set('X-Powered-By', '@webqit/webflo');
        return request;
    }

    async navigate(url, init = {}, detail = {}) {
        // Scope object
        const scopeObj = {
            url,
            init,
            detail,
            requestID: (0 | Math.random() * 9e6).toString(36),
            tenantID: 'anon',
        };
        if (typeof scopeObj.url === 'string') {
            scopeObj.url = new URL(scopeObj.url, window.location.origin);
        }

        // Request
        scopeObj.request = scopeObj.init instanceof Request && scopeObj.init.url === scopeObj.url.href
            ? scopeObj.init
            : this.createRequest(scopeObj.url, scopeObj.init);
        RequestPlus.upgradeInPlace(scopeObj.request);

        // Origins
        const origins = [scopeObj.requestID];

        // Thread
        scopeObj.thread = HttpThread111.create({
            context: {},
            store: this.#keyvals.create({ path: ['thread', scopeObj.tenantID], origins }),
            threadID: scopeObj.url.searchParams.get('_thread'),
            realm: 1
        });

        // Cookies
        if (typeof cookieStore === 'undefined') {
            const entries = document.cookie.split(';').map((c) => c.split('=').map((s) => s.trim()));
            const store = this.#keyvals.create({ type: 'inmemory', path: ['cookies', scopeObj.tenantID], origins });
            entries.forEach(([key, value]) => store.set({ key, value }));
            const initial = Object.fromEntries(entries);
            scopeObj.cookies = HttpCookies101.create({
                context: { handlersRegistry: this.#keyvals.getHandlers('cookies', true) },
                store,
                initial,
                realm: 1
            });
        } else {
            scopeObj.cookies = HttpCookies110.create({
                context: { handlersRegistry: this.#keyvals.getHandlers('cookies', true) },
                store: this.#keyvals.create({ type: 'cookiestore', path: ['cookies', scopeObj.tenantID], origins }),
                realm: 1
            });
        }

        // Session
        scopeObj.session = HttpSession110.create({
            context: { handlersRegistry: this.#keyvals.getHandlers('session', true) },
            store: this.#keyvals.create({ type: 'indexeddb', path: ['session', scopeObj.tenantID], origins }),
            realm: 1
        });

        // User
        scopeObj.user = HttpUser111.create({
            context: { handlersRegistry: this.#keyvals.getHandlers('user', true) },
            store: this.#keyvals.create({ type: 'indexeddb', path: ['user', scopeObj.tenantID], origins }),
            realm: 1
        });

        // UIState
        if (window.webqit?.oohtml?.configs) {
            const { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs;
            scopeObj.UIState = (this.host[bindingsConfig.bindings] || {}).state;
        }

        // ClientPort
        scopeObj.clientRequestPort = new ClientRequestPort100({ handshake: 1, postAwaitsOpen: true });

        // HttpEvent111
        scopeObj.httpEvent = HttpEvent111.create({
            detail: scopeObj.detail,
            signal: init.signal,
            request: scopeObj.request,
            thread: scopeObj.thread,
            cookies: scopeObj.cookies,
            session: scopeObj.session,
            user: scopeObj.user,
            client: scopeObj.clientRequestPort.port1,
            state: scopeObj.UIState,
            realm: 1
        }, true);

        // Set pre-request states
        Observer.set(this.navigator, {
            requesting: new URL(scopeObj.url),
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
        // !IMPORTANT: Posting to the group when empty will keep the event until next addition
        // and we don't want that
        if (this.#background.length) {
            const url = { ...URLPlus.copy(scopeObj.url), method: scopeObj.request.method };
            this.#background.postMessage(url, { type: 'navigate' });
        }

        // Dispatch for response
        scopeObj.response = await this.dispatchNavigationEvent({
            httpEvent: scopeObj.httpEvent,
            crossLayerFetch: async (event) => {
                // Was this nexted()? Tell the next layer we're in JSON mode by default
                if (event !== scopeObj.httpEvent && !event.request.headers.has('Accept')) {
                    event.request.headers.set('Accept', 'application/json');
                }
                return await this.remoteFetch(event.request);
            },
            clientPortB: scopeObj.clientRequestPort.port2,
            originalRequestInit: scopeObj.init
        });

        // Commit cookies
        if (typeof cookieStore === 'undefined') {
            for (const cookieStr of await scopeObj.cookies.render()) {
                document.cookie = cookieStr;
            }
            await scopeObj.cookies._commit();
        }

        // Decode response
        scopeObj.finalUrl = scopeObj.response.url || scopeObj.request.url;
        if (scopeObj.response.redirected || scopeObj.detail.navigationType === 'rdr' || scopeObj.detail.isHoisted) {
            const stateData = { ...(this.currentEntry()?.getState() || {}), redirected: true, };
            await this.updateCurrentEntry({ state: stateData }, scopeObj.finalUrl);
        }

        // Transition UI
        await this.transitionUI(async () => {
            // Set post-request states
            Observer.set(this.location, 'href', scopeObj.finalUrl);
            scopeObj.resetStates();

            // Error?
            const statusCode = scopeObj.response.status;
            if ([404, 500].includes(statusCode)) {
                const error = new Error(scopeObj.response.statusText, { code: statusCode });
                Object.defineProperty(error, 'retry', { value: async () => await this.navigate(scopeObj.url, scopeObj.init, scopeObj.detail) });
                Observer.set(this.navigator, 'error', error);
            }

            // Render response
            await this.render(
                scopeObj.httpEvent,
                scopeObj.response,
                !(['GET'].includes(scopeObj.request.method) || scopeObj.response.redirected || scopeObj.detail.navigationType === 'rdr')
            );

            await this.applyPostRenderState(scopeObj.httpEvent);
        }, scopeObj.finalUrl, scopeObj.detail);
    }

    async dispatchNavigationEvent({ httpEvent, crossLayerFetch, clientPortB, originalRequestInit, processObj = {} }) {
        let response = await super.dispatchNavigationEvent({ httpEvent, crossLayerFetch, clientPortB });

        // Extract interactive. mode handling
        const handleInteractiveMode = (returnImmediate = false) => {
            return new Promise(async (resolve) => {
                // Must come as first thing
                const backgroundPort = LiveResponse.getPort(response);
                this.background.addPort(backgroundPort);

                const liveResponse = response instanceof LiveResponse
                    ? response
                    : LiveResponse.from(response);

                await liveResponse.readyStateChange('live');
                // IMPORTANT: ensures we're listening to subsequent changes.

                liveResponse.addEventListener('replace', () => {
                    if (liveResponse.headers.get('Location')) {
                        this.processRedirect(liveResponse);
                    } else {
                        resolve(liveResponse);
                    }
                }, { signal: httpEvent.signal });

                if (returnImmediate) resolve(liveResponse);
            });
        };

        // Await a response with an "Accepted" or redirect status
        const statusCode = response.status;
        if (statusCode === 202 && LiveResponse.hasPort(response)) {
            return await handleInteractiveMode();
        }

        // Handle redirects
        if (response.headers.get('Location')) {
            await this.processRedirect(response);
            if (LiveResponse.hasPort(response)) {
                return await handleInteractiveMode();
            }
        }

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
                const eventClone = httpEvent.clone({ request: this.createRequest(httpEvent.url, originalRequestInit) });
                return await this.dispatchNavigationEvent({ httpEvent: eventClone, crossLayerFetch, clientPortB, originalRequestInit, processObj });
            }
        } else {
            if (processObj.recurseController) {
                // Abort the signal. This is the end of the loop
                processObj.recurseController.abort();
            }

            // Obtain and connect clientPortB as first thing
            if (LiveResponse.hasPort(response)) {
                response = await handleInteractiveMode(true);
            }
        }

        return response;
    }

    async processRedirect(response) {
        // Normalize redirect
        const statusCode = response.headers.has('X-Redirect-Code')
            ? parseInt(response.headers.get('X-Redirect-Code'))
            : response.status;

        // Trigger redirect
        if ([302, 301].includes(statusCode)) {
            const location = new URL(response.headers.get('Location'), this.location.origin);
            if (this.isSpaRoute(location)) {
                this.navigate(location, {}, { navigationType: 'rdr' });
                return;
            }

            // External redirect
            await this.redirect(location, response);
        }
    }

    async redirect(location) {
        window.location = location;
        await new Promise(() => { });
    }

    async transitionUI(updateCallback, finalUrl, detail) {
        // Set initial states
        Observer.set(this.transition.from, URLPlus.copy(this.location));
        Observer.set(this.transition.to, 'href', finalUrl);
        const viewTransitionRel = this.transition.from.pathname === this.transition.to.pathname ? 'same' : (
            `${this.transition.from.pathname}/`.startsWith(`${this.transition.to.pathname}/`) ? 'out' : (
                `${this.transition.to.pathname}/`.startsWith(`${this.transition.from.pathname}/`) ? 'in' : 'other'
            )
        );
        Observer.set(this.transition, 'rel', viewTransitionRel);
        // Trigger transition
        if (document.startViewTransition && this.withViewTransitions && !detail.hasUAVisualTransition) {
            const synthesizeWhile = window.webqit?.realdom?.synthesizeWhile || ((callback) => callback());
            return new Promise(async (resolve) => {
                await synthesizeWhile(async () => {
                    Observer.set(this.transition, 'phase', 'old');
                    const viewTransition = document.startViewTransition({ update: updateCallback, styles: ['navigation', viewTransitionRel] });
                    try { await viewTransition.updateCallbackDone; } catch (e) { console.log(e); }
                    Observer.set(this.transition, 'phase', 'new');
                    try { await viewTransition.ready; } catch (e) { console.log(e); }
                    Observer.set(this.transition, 'phase', 'start');
                    try { await viewTransition.finished; } catch (e) { console.log(e); }
                    Observer.set(this.transition, 'phase', 'end');
                    resolve();
                });
            });
        } else await updateCallback();
    }

    async render(httpEvent, response, merge = false) {
        const router = new WebfloRouter111(this, this.location.pathname);
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
                const $response = await LiveResponse.from(response).readyStateChange('live');
                this.host[bindingsConfig.bind]({
                    state: {},
                    data: $response.body,
                    env: 'client',
                    viewport: this.viewport,
                    navigator: this.navigator,
                    location: this.location,
                    network: this.network, // request, redirect, error, status, remote
                    capabilities: this.capabilities,
                    transition: this.transition,
                }, { diff: true, merge });
                $response.addEventListener('replace', (e) => {
                    if (!$response.headers.get('Location')) {
                        this.host[bindingsConfig.bindings].data = $response.body;
                    }
                });
            }
            if (modulesContextAttrs) {
                const newRoute = '/' + `app/${this.location.pathname}`.split('/').map(a => (a => a.startsWith('$') ? '-' : a)(a.trim())).filter(a => a).join('/');
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