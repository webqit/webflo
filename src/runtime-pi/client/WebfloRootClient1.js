import { WebfloClient } from './WebfloClient.js';
import { Context } from './Context.js';
import { Workport } from './Workport.js';

const { Observer } = webqit;

export class WebfloRootClient1 extends WebfloClient {

	static get Context() { return Context; }

	static get Workport() { return Workport; }

	static create(host, cx = {}) {
        return new this(host, this.Context.create(cx));
    }

	#cx;
	get cx() { return this.#cx; }

    #network;
    get network() { return this.#network; }

    #workport;
    get workport() { return this.#workport; }

    #permissions;
    get permissions() { return this.#permissions; }

	constructor(host, cx) {
		if (!(host instanceof Document)) {
			throw new Error('Argument #1 must be a Document instance');
		}
		super(host);
		if (!(cx instanceof this.constructor.Context)) {
			throw new Error('Argument #2 must be a Webflo Context instance');
		}
		this.#cx = cx;
		this.#network = { status: window.navigator.onLine };
		this.#workport = new this.constructor.Workport;
	}

	initialize() {
		// Main initializations
		const undoControl = super.initialize();
        // Bind network status handlers
        const onlineHandler = () => Observer.set(this.network, 'status', window.navigator.onLine);
        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', onlineHandler);
		let $undoControl = () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', onlineHandler);
            undoControl();
        };
		// Window opener pinging
		if (window.opener) {
			const $$undoControl = $undoControl;
			const beforeunloadHandler = () => {
				window.opener.postMessage('close');
			};
			window.addEventListener('beforeunload', beforeunloadHandler);
			$undoControl = () => {
				window.removeEventListener('beforeunload', beforeunloadHandler);
				$$undoControl();
			};
		}
		// Bind global prompt handlers
        const promptsHandler = (e) => {
            e.stopPropagation();
            setTimeout(() => {
                if (e.defaultPrevented || e.immediatePropagationStopped) return;
				let message = e.data;
				if (e.data?.message) {
					message = e.data.message + (e.data.details ? `\r\n${e.data.details}` : '');
				}
                window.queueMicrotask(() => {
					if (e.type === 'confirm') {
						e.respondWith(confirm(message));
					} else if (e.type === 'prompt') {
						e.respondWith(prompt(message));
					}
				});
            }, 10);
        };
        this.backgroundMessaging.handleMessages('confirm', promptsHandler);
        this.backgroundMessaging.handleMessages('prompt', promptsHandler);
		// Service Worker && COMM
		if (this.cx.params.service_worker?.filename) {
			const { public_base_url: base, service_worker: { filename, ...restServiceWorkerParams } } = this.cx.params;
			const { webflo_public_webhook_url_variable, webflo_vapid_public_key_variable, ..._restServiceWorkerParams } = restServiceWorkerParams;
			const swParams = {
				..._restServiceWorkerParams,
				WEBFLO_PUBLIC_WEBHOOK_URL: this.cx.params.env[webflo_public_webhook_url_variable],
				WEBFLO_VAPID_PUBLIC_KEY: this.cx.params.env[webflo_vapid_public_key_variable],
				startMessages: true
			};
			this.#workport.registerServiceWorker(base + filename, swParams);
		}
		// Respond to background activity request at pageload
		const scope = {};
        if (scope.backgroundMessagingMeta = document.querySelector('meta[name="X-Background-Messaging"]')) {
			scope.backgroundMessaging = this.$createBackgroundMessagingFrom(scope.backgroundMessagingMeta.content);
			this.backgroundMessaging.add(scope.backgroundMessaging);
        }
        if (scope.hydrationData = document.querySelector('script[rel="hydration"][type="application/json"]')) {
			try {
				const hydrationDataJson = JSON.parse((scope.hydrationData.textContent + '').trim());
				const httpEvent = this.constructor.HttpEvent.create(null, { url: this.location.href});
				window.queueMicrotask(() => {
					this.render(httpEvent, hydrationDataJson);
				});
			} catch(e) {}
        }
		return $undoControl;
	}

	/**
	 * The following methods
	 * are not to be inherited
	 * by sub classes
	 */

	control() {
		// IMPORTANT: we're calling super.controlClassic()
		const undoControl = super.controlClassic((newHref) => {
            try {
                // Save current scroll position
                window.history.replaceState({
                    ...(this.currentEntry()?.getState?.() || {}),
                    scrollPosition: this.host === window.document ? [window.scrollX, window.scrollY] : [this.host.scrollLeft, this.host.scrollTop,],
                }, '', this.location.href);
            } catch (e) { }
            // Do actual location update
            try { window.history.pushState({}, '', newHref); } catch (e) { }
        });
		// ONPOPSTATE
		const popstateHandler = (e) => {
			if (this.isHashChange(location)) {
				Observer.set(this.location, 'href', location.href);
				return;
			}
			// Navigation details
			const detail = {
				navigationType: 'traverse',
				navigationOrigins: [],
				destination: this._asEntry(e.state),
				source: this.currentEntry(),
				userInitiated: true,
			};
			// Traversal?
			// Push
			this.navigate(location.href, {}, detail);
		};
		window.addEventListener('popstate', popstateHandler);
        return () => {
            this.host.removeEventListener('popstate', popstateHandler);
            undoControl();
        };
	}

    reload() {
		return window.history.reload();
	}

	back() {
		return window.history.back();
	}

	forward() {
		return window.history.forward();
	}

	traverseTo(...args) {
		return window.history.go(...args);
	}

	entries() {
		return window.history;
	}

	currentEntry() {
		return this._asEntry(history.state);
	}

	async updateCurrentEntry(params, url = null) {
		window.history.replaceState(params.state, '', url);
	}

	async push(url, state = {}) {
		if (typeof url === 'string' && url.startsWith('&')) { url = this.location.href.split('#')[0] + (this.location.href.includes('?') ? url : url.replace('&', '?')); }
		url = new URL(url, this.location.href);
		window.history.pushState(state, '', url.href);
		Observer.set(this.location, 'href', url.href);
	}

	async applyPostRenderState(httpEvent) {
		const destinationState = httpEvent.detail.destination?.getState() || {};
		if (destinationState.scrollPosition?.length) {
			window.scroll(...destinationState.scrollPosition);
			(document.querySelector('[autofocus]') || document.body).focus();
		} else await super.applyPostRenderState(httpEvent);
	}
}