import { Observer } from '@webqit/quantum-js';
import { WebfloClient } from './WebfloClient.js';
import { defineElement } from './webflo-embedded.js';
import { Url } from '../webflo-url/Url.js';
import { $parentNode } from '../../util.js';

export class WebfloSubClient extends WebfloClient {

	static defineElement() {
		defineElement(this);
	}

	static create(superRuntime, host) {
		return new this(superRuntime, host);
	}

	#superRuntime;
	get superRuntime() { return this.#superRuntime; }

	get network() { return this.#superRuntime.network; }

	get workport() { return this.#superRuntime.workport; }

	get deviceCapabilities() { return this.#superRuntime.deviceCapabilities; }

	get withViewTransitions() { return this.host.hasAttribute('viewtransitions'); }

	constructor(superRuntime, host) {
		if (!(superRuntime instanceof WebfloClient)) {
			throw new Error('Argument #2 must be a Webflo Client instance');
		}
		if (!(host instanceof HTMLElement)) {
			throw new Error('Argument #1 must be a HTMLElement instance');
		}
		super(superRuntime.cx, host);
		this.#superRuntime = superRuntime;
	}

	async initialize() {
		if (this.host.location.origin !== window.location.origin) {
			throw new Error(`Webflo embeddable origin violation in "${window.location}"`);
		}
		this.backgroundMessagingPorts[$parentNode] = this.#superRuntime.backgroundMessagingPorts;
		const instanceController = await super.initialize();
		instanceController.signal.addEventListener('abort', () => {
			if (this.backgroundMessagingPort[$parentNode] === this.#superRuntime.backgroundMessagingPort) {
				this.backgroundMessagingPort[$parentNode] = null;
			}
		}, { once: true });
		return instanceController;
	}

	async hydrate() {
		const instanceController = await super.hydrate();
		if (this.host.hasAttribute('location')) {
			await this.navigate(this.location.href);
		}
		return instanceController;
	}

	control() {
		const locationCallback = (newHref) => {
			this.host.reflectLocation(newHref);
		};
		return super.controlClassic/*IMPORTANT*/(locationCallback);
	}

	reload(params) {}

	back() {}

	forward() {}

	traverseTo(...args) {}

	async push(url, state = {}) {}

	entries() {}

	currentEntry() {}

	async updateCurrentEntry(params, url = null) {
		this.host.reflectLocation(url);
	}

	async applyPostRenderState(httpEvent) {
		if (httpEvent.url.hash) {
			this.host.querySelector(httpEvent.url.hash)?.scrollIntoView();
		} else await super.applyPostRenderState(httpEvent);
		(this.host.querySelector('[autofocus]') || this.host).focus();
	}

	redirect(location, backgroundMessagingPort = null) {
		location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
		const width = Math.min(800, window.innerWidth);
		const height = Math.min(600, window.innerHeight);
		const left = (window.outerWidth - width) / 2;
		const top = (window.outerHeight - height) / 2;
		const popup = window.open(location, '_blank', `popup=true,width=${width},height=${height},left=${left},top=${top}`);
		if (backgroundMessagingPort) {
			Observer.set(this.navigator, 'redirecting', new Url/*NOT URL*/(location), { diff: true });
			backgroundMessagingPort.addEventListener('close', (e) => {
				window.removeEventListener('message', windowMessageHandler);
				Observer.set(this.navigator, 'redirecting', null);
				popup.postMessage('timeout:5');
				setTimeout(() => {
					popup.close();
				}, 5000);
			}, { once: true });
			const windowMessageHandler = (e) => {
				if (e.source === popup && e.data === 'close') {
					backgroundMessagingPort.close();
				}
			};
			window.addEventListener('message', windowMessageHandler);
		}
	}
}