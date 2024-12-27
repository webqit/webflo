import { _before, _toTitle } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { params as httpParams } from '../util-url.js';
import { AbstractController as AbsCntrl } from '../AbstractController.js';
import { CookieStorage } from './CookieStorage.js';
import { WebStorage } from './WebStorage.js';
import { HttpEvent } from '../HttpEvent.js';
import { Router } from './Router.js';
import { Url } from './Url.js';
import xfetch from '../xfetch.js';
import '../util-http.js';

const { Observer } = webqit;

export class AbstractController extends AbsCntrl {

	static get Router() { return Router; }

	static get HttpEvent() { return HttpEvent; }

	static get CookieStorage() { return CookieStorage; }

	static get SessionStorage() { return WebStorage; }

	static get LocalStorage() { return WebStorage; }

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

    constructor(host) {
        super();
        this.#host = host;
        Object.defineProperty(this.host, 'getWebfloControllerInstance', { value: () => this });
        this.#network = { status: window.navigator.onLine };
        this.#location = this.host.location
            ? new Url(this.host.location)
            : {};
        this.#navigator = {
            requesting: null,
            redirecting: null,
            remotely: false,
            origins: [],
            error: null,
        };
        this.#transition = {
            phase: 0,
            rel: null
        };
    }

    initialize() {
        const onlineHandler = () => Observer.set(this.network, 'status', window.navigator.onLine);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', onlineHandler);
        const uncontrols = this.control();
        this.navigate(this.location, {}, { navigationType: 'startup', });
        return () => {
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
            if (this.isHashChange(anchorEl)) {
                Observer.set(this.location, 'href', anchorEl.href);
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
            locationCallback(anchorEl.href); // this
            this.navigate(
                Url.copy(anchorEl),
                { signal: this._abortController.signal, },
                detail,
            ); // this
        };
        // -----------------------
        // Capture all form-submits
        const submitHandler = (e) => {
            if (!this._canIntercept(e)) return;
            // ---------------
            // Declare form submission modifyers
            const form = e.target.closest('form'), submitter = e.submitter;
            const submitParams = ['action', 'enctype', 'method', 'noValidate', 'target'].reduce((params, prop) => {
                params[prop] = submitter && submitter.hasAttribute(`form${prop.toLowerCase()}`) ? submitter[`form${_toTitle(prop)}`] : form[prop];
                return params;
            }, {});
            submitParams.method = (submitter && submitter.dataset.formmethod) || form.dataset.method || submitParams.method;
            if (submitParams.target || !this.isSpaRoute(submitParams.action)) return;
            const actionEl = window.document.createElement('a');
            actionEl.href = submitParams.action;
            if (this.isHashChange(anchorEl) && submitParams.method.toUpperCase() !== 'POST') {
                Observer.set(this.location, 'href', anchorEl.href);
                return;
            }
            // ---------------
            // Handle now
            let formData = new FormData(form);
            if ((submitter || {}).name) {
                formData.set(submitter.name, submitter.value);
            }
            if (submitParams.method.toUpperCase() === 'GET') {
                const query = {};
                Array.from(formData.entries()).forEach((_entry) => {
                    httpParams.set(query, _entry[0], _entry[1]);
                });
                actionEl.search = httpParams.stringify(query);
                formData = null;
            }
            e.preventDefault();
            this._abortController?.abort();
            this._abortController = new AbortController();
            // Note the order of calls below
            const detail = {
                navigationType: 'push',
                navigationOrigins: [submitter, form],
                destination: this._asEntry(null),
                source: this.currentEntry(), // this
                userInitiated: true,
            };
            locationCallback(actionEl.href); // this
            this.navigate(
                Url.copy(actionEl),
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

    async redirect(location) {
        location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
        Observer.set(this.navigator, 'redirecting', location, { diff: true });
        if (this.isSpaRoute(location)) {
            await this.navigate(location, {}, { navigationType: 'rdr' });
        } else this.hardRedirect(location);
    }

    hardRedirect(location) {
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
        // Create and route request
        scope.request = this.createRequest(scope.url, scope.init);
        scope.cookieStorage = this.constructor.CookieStorage.create();
        scope.sessionStorage = this.constructor.SessionStorage.create('sessionStorage');
        scope.localStorage = this.constructor.LocalStorage.create('localStorage');
        scope.httpEvent = new this.constructor.HttpEvent(scope.request, scope.detail, scope.cookieStorage, scope.sessionStorage, scope.localStorage, this.workport);
        // Ste pre-request states
        Observer.set(this.navigator, {
            requesting: new URL(scope.url),
            origins: scope.detail.navigationOrigins || [],
            method: scope.request.method,
            error: null
        });
        scope.context = {};
        if (window.webqit?.oohtml?.configs) {
            const { BINDINGS_API: { api: bindingsConfig } = {}, } = window.webqit.oohtml.configs;
            scope.context = this.host[bindingsConfig.bindings];
        }
        scope.response = await this.dispatch(scope.httpEvent, scope.context, async (event) => {
            // Was this nexted()? Tell the next layer we're in JSON mode by default
            if (event !== scope.httpEvent && !event.request.headers.has('Accept')) {
                event.request.headers.set('Accept', 'application/json');
            }
            return await this.remoteFetch(event.request);
        });
        const finalUrl = scope.response.url || scope.request.url;
        this._prevPathname = this.location.pathname;
        Observer.set(this.location, 'href', finalUrl);
        // Set post-request states
        Observer.set(this.navigator, {
            requesting: null,
            redirecting: null,
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
        // Render
        const data = (await scope.response.parse()) || {};
        await this.render(scope.httpEvent, data);
    }

    async dispatch(httpEvent, context, crossLayerFetch) {
        const response = await super.dispatch(httpEvent, context, crossLayerFetch);
        if (response.headers.get('Location')) {
            // Normalize redirect
            const xActualRedirectCode = parseInt(response.headers.get('X-Redirect-Code'));
            if (xActualRedirectCode && response.status === this._xRedirectCode) {
                response.meta.status = xActualRedirectCode; // @NOTE 1
            }
            // Trigger redirect
            if ([302, 301].includes(response.status)) {
                this.redirect(response);
            }
        }
        // Handle "retry" directives
        if (response.headers.get('Retry-After')) {
            await new Promise((res) => setTimeout(res, parseFloat(response.headers.get('Retry-After')) * 1000));
            return await this.dispatch(httpEvent, context, crossLayerFetch);
        }
        return response;
    }

    async render(httpEvent, data) {
        const execRender = async () => {
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
                        location: this.location,
                        referrer: this.referrer,
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
        };
        if (document.startViewTransition && httpEvent.detail.navigationType !== 'startup') {
            const synthesizeWhile = window.webqit?.realdom?.synthesizeWhile || (callback => callback());
            synthesizeWhile(async () => {
                const rel = this._prevPathname === this.location.pathname ? 'same' : (`${this._prevPathname}/`.startsWith(`${this.location.pathname}/`) ? 'parent' : (`${this.location.pathname}/`.startsWith(`${this._prevPathname}/`) ? 'child' : 'unrelated'));
                Observer.set(this.transition, { rel, phase: 1 });
                const viewTransition = document.startViewTransition(execRender);
                try { await viewTransition.updateCallbackDone; } catch (e) { console.log(e); }
                Observer.set(this.transition, 'phase', 2);
                try { await viewTransition.ready; } catch (e) { console.log(e); }
                Observer.set(this.transition, 'phase', 3);
                try { await viewTransition.finished; } catch (e) { console.log(e); }
                Observer.set(this.transition, { rel: null, phase: 0 });
            });
        } else await execRender();
    }
	
	async remoteFetch(request, ...args) {
		Observer.set(this.#navigator, 'remotely', true);
		const response = await xfetch(request, ...args);
		Observer.set(this.#navigator, 'remotely', false);
        return response;
	}
}