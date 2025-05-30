import { Observer } from '@webqit/quantum-js';
import { WebfloClient } from './WebfloClient.js';
import { Context } from './Context.js';
import { Capabilities } from './Capabilities.js';
import { ClientSideWorkport } from './ClientSideWorkport.js';

export class WebfloRootClient1 extends WebfloClient {

	static get Context() { return Context; }

	static get Workport() { return ClientSideWorkport; }

	static get Capabilities() { return Capabilities; }

	static create(host, cx = {}) {
		return new this(host, this.Context.create(cx));
	}

	#cx;
	get cx() { return this.#cx; }

	#network;
	get network() { return this.#network; }

	#workport;
	get workport() { return this.#workport; }

	#capabilities;
	get capabilities() { return this.#capabilities; }

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
	}

	async initialize() {
		// INITIALIZATIONS
		const instanceController = await super.initialize();
		// Service Worker && Capabilities
		const cleanups = [];
		instanceController.signal.addEventListener('abort', () => cleanups.forEach((c) => c()), { once: true });
		this.#capabilities = await this.constructor.Capabilities.initialize(this, this.cx.params.capabilities);
		cleanups.push(() => this.#capabilities.close());
		if (this.cx.params.capabilities?.service_worker?.filename) {
			const { service_worker: { filename, ...restServiceWorkerParams } = {} } = this.cx.params.capabilities;
			this.#workport = await this.constructor.Workport.initialize(null, (this.cx.params.public_base_url || '') + filename, restServiceWorkerParams);
			cleanups.push(() => this.#workport.close());
		}
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
		this.backgroundMessagingPorts.handleRequests('ua:query', async (e) => {
			if (e.data?.query === 'push_registration') {
				const pushManager = (await navigator.serviceWorker.getRegistration()).pushManager;
				const r = await pushManager.getSubscription();
				return r;
			}
		}, { signal: instanceController.signal });
		// Bind top-level Storage requests
		this.backgroundMessagingPorts.handleRequests('storage:query', (e) => {
			const { source, namespace, query, key, value } = e.data;
			const storage = source === 'session' ? sessionStorage : (source === 'local' ? localStorage : null);
			if (!storage) return;
			const data = JSON.parse(storage.getItem(namespace) || (query === 'set' ? '{}' : 'null'));
			switch (query) {
				case 'has':
					return !!data && Reflect.has(data, key);
				case 'get':
					return data && Reflect.get(data, key);
				case 'set':
					Reflect.set(data, key, value);
					return storage.setItem(namespace, JSON.stringify(data))
				case 'delete':
					if (!data) return;
					Reflect.deleteProperty(data, key);
					return storage.setItem(namespace, JSON.stringify(data));
				case 'clear':
					return storage.removeItem(namespace);
				case 'keys':
					return data && Reflect.ownKeys(data) || [];
				case 'values':
					return data && Object.values(data) || [];
				case 'entries':
					return data && Object.entries(data) || [];
				case 'size':
					return data && Object.keys(data).length || 0;
			}
		}, { signal: instanceController.signal });
		return instanceController;
	}

	async hydrate() {
		const instanceController = await super.hydrate();
		const body = this.host.querySelector('script[rel="hydration"][type="application/json"]')?.textContent?.trim();
		const backgroundMessagingPort = this.host.querySelector('meta[name="X-Background-Messaging-Port"]')?.content?.trim();
		const liveResponseGeneratorDone = this.host.querySelector('meta[name="X-Live-Response-Generator-Done"]')?.content?.trim();
		const liveResponseFrameTag = this.host.querySelector('meta[name="X-Live-Response-Frame-Tag"]')?.content?.trim();
		if (body || backgroundMessagingPort) {
			const normalResponse = new Response.create(body, { headers: { 'Content-Type': 'application/json' }});
			normalResponse.headers.set('X-Background-Messaging-Port', backgroundMessagingPort || '');
			normalResponse.headers.set('X-Live-Response-Generator-Done', liveResponseGeneratorDone || '');
			normalResponse.headers.set('X-Live-Response-Frame-Tag', liveResponseFrameTag || '');
			const liveResponse = await LiveResponse.fromResponse(normalResponse);
			this.backgroundMessagingPorts.add(liveResponse.backgroundMessagingPort);
			const httpEvent = this.createHttpEvent({ request: this.createRequest(this.location.href) }, true);
			await this.render(httpEvent, liveResponse);
		} else if (this.canDoStartupFlight()) {
			await this.navigate(this.location.href);
		}
		return instanceController;
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

	async push(url, state = {}) {
		if (typeof url === 'string' && url.startsWith('&')) { url = this.location.href.split('#')[0] + (this.location.href.includes('?') ? url : url.replace('&', '?')); }
		url = new URL(url, this.location.href);
		window.history.pushState(state, '', url.href);
		Observer.set(this.location, 'href', url.href);
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

	async applyPostRenderState(httpEvent) {
		const destinationState = httpEvent.detail.destination?.getState() || {};
		if (destinationState.scrollPosition?.length) {
			window.scroll(...destinationState.scrollPosition);
			(document.querySelector('[autofocus]') || document.body).focus();
		} else await super.applyPostRenderState(httpEvent);
	}
}