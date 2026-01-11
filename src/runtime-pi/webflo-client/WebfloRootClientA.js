import { Observer } from '@webqit/observer';
import { LiveResponse } from '@webqit/fetch-plus';
import { HttpEvent111 } from '../webflo-routing/HttpEvent111.js';
import { ClientSideWorkport } from './ClientSideWorkport.js';
import { DeviceCapabilities } from './DeviceCapabilities.js';
import { WebfloClient } from './WebfloClient.js';
import { WebfloHMR } from './webflo-devmode.js';

export class WebfloRootClientA extends WebfloClient {

	static get Workport() { return ClientSideWorkport; }

	static get DeviceCapabilities() { return DeviceCapabilities; }

	static create(bootstrap, host) {
		return new this(bootstrap, host);
	}

	#network;
	get network() { return this.#network; }

	#workport;
	get workport() { return this.#workport; }

	#capabilities;
	get capabilities() { return this.#capabilities; }

	#hmr;

	get withViewTransitions() {
		return document.querySelector('meta[name="webflo:viewtransitions"]')?.value;
	}

	constructor(bootstrap, host) {
		if (!(host instanceof Document)) {
			throw new Error('Argument #1 must be a Document instance');
		}
		super(bootstrap, host);
		this.#network = { status: window.navigator.onLine };
	}

	async initialize() {
		// INITIALIZATIONS
		const instanceController = await super.initialize();
		
		// Bind network status handlers
		const onlineHandler = () => Observer.set(this.network, 'status', window.navigator.onLine);
		window.addEventListener('online', onlineHandler, { signal: instanceController.signal });
		window.addEventListener('offline', onlineHandler, { signal: instanceController.signal });
		
		// Window opener pinging
		if (window.opener) {
			const beforeunloadHandler = () => window.opener.postMessage('close');
			window.addEventListener('beforeunload', beforeunloadHandler, { signal: instanceController.signal });
		}

		// Bind top-level User-Agent requests
		this.background.addRequestListener('query', async (e) => {
			if (e.data?.query === 'push_registration') {
				const pushManager = (await navigator.serviceWorker.getRegistration()).pushManager;
				return await pushManager.getSubscription();
			}
		}, { signal: instanceController.signal });

		return instanceController;
	}

	async setupCapabilities() {
		const instanceController = await super.setupCapabilities();
		const cleanups = [];

		// Service Worker && Capabilities
		instanceController.signal.addEventListener('abort', () => cleanups.forEach((c) => c()), { once: true });
		this.#capabilities = await this.constructor.DeviceCapabilities.initialize(this, this.config.CLIENT.capabilities);
		cleanups.push(() => this.#capabilities.close());

		if (this.config.CLIENT.capabilities?.service_worker) {
			const { filename, ...restServiceWorkerParams } = this.config.WORKER;
			this.constructor.Workport.initialize(null, filename, restServiceWorkerParams).then((workport) => {
				this.#workport = workport;
				cleanups.push(() => this.#workport.close());
			});
		}

		return instanceController;
	}

	async hydrate() {
		const instanceController = await super.hydrate();
		const scopeObj = {};

		try {
			scopeObj.data = JSON.parse(this.host.querySelector(`script[rel="hydration"][type="application/json"]`)?.textContent?.trim() || 'null');
		} catch (e) { }
		scopeObj.response = new LiveResponse(scopeObj.data, { headers: { 'Content-Type': 'application/json' } });
		
		for (const name of ['X-Message-Port', 'X-Webflo-Dev-Mode']) {
			const metaElement = this.host.querySelector(`meta[name="${name}"]`);
			if (!metaElement) continue;
			scopeObj.response.headers.set(name, metaElement.content?.trim() || '');
		}

		if (scopeObj.response.port) {
			this.background.addPort(scopeObj.response.port);
		}

		if (scopeObj.response.body || scopeObj.response.port) {
			const httpEvent = HttpEvent111.create({ request: this.createRequest(this.location.href) }, true);
			await this.render(httpEvent, scopeObj.response);
		} else {
			await this.navigate(this.location.href);
		}

		if (scopeObj.response.headers.get('X-Webflo-Dev-Mode') === 'true') {
			this.enterDevMode();
		}

		return instanceController;
	}

	async enterDevMode() {
		this.#hmr = WebfloHMR.manage(this);
	}

	control() {
		// ON LOCATION CHANGE
		const locationCallback = (newHref) => {
			try {
				const scrollPosition = this.host === window.document
					? [window.scrollX, window.scrollY]
					: [this.host.scrollLeft, this.host.scrollTop,];
				const state = { ...(this.currentEntry()?.getState?.() || {}), scrollPosition };
				window.history.replaceState(state, '', this.location.href);
			} catch (e) { }

			try { window.history.pushState({}, '', newHref); } catch (e) { }
		};
		const instanceController = super.controlClassic/*IMPORTANT*/(locationCallback);
		
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
		window.addEventListener('popstate', popstateHandler, { signal: instanceController.signal });
		
		return instanceController;
	}

	reload() { return window.history.reload(); }

	back() { return window.history.back(); }

	forward() { return window.history.forward(); }

	traverseTo(...args) { return window.history.go(...args); }

	async push(url, state = {}) {
		if (typeof url === 'string' && url.startsWith('&')) { url = this.location.href.split('#')[0] + (this.location.href.includes('?') ? url : url.replace('&', '?')); }
		url = new URL(url, this.location.href);
		window.history.pushState(state, '', url.href);
		Observer.set(this.location, 'href', url.href);
	}

	entries() { return window.history; }

	currentEntry() { return this._asEntry(history.state); }

	async updateCurrentEntry(params, url = null) {
		window.history.replaceState(params.state, '', url);
	}

	async applyPostRenderState(httpEvent) {
		const destinationState = httpEvent.detail.destination?.getState() || {};
		if (destinationState.scrollPosition?.length) {
			window.scroll(...destinationState.scrollPosition);
			(document.querySelector('[autofocus]') || document.body).focus();
		} else await super.applyPostRenderState(httpEvent);
	}
}