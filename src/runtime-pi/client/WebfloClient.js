import { AbstractController } from './AbstractController.js';
import { WebfloEmbedded } from './WebfloEmbedded.js';
import { Workport } from './Workport.js';
import { Context } from './Context.js';

const { Observer } = webqit;

export class WebfloClient extends AbstractController {

	static get Context() { return Context; }

	static get Workport() { return Workport; }

	static create(host, cx = {}) {
        return new this(host, this.Context.create(cx));
    }

	#cx;
	get cx() { return this.#cx; }

	#workport;
	get workport() { return this.#workport; }

	constructor(host, cx) {
		if (!(host instanceof Document)) {
			throw new Error('Argument #1 must be a Document instance');
		}
		super(host);
		if (!(cx instanceof this.constructor.Context)) {
			throw new Error('Argument #2 must be a Webflo Context instance');
		}
		this.#cx = cx;
	}

	initialize() {
		// Service Worker && COMM
		if (this.cx.params.service_worker?.filename) {
			const { public_base_url: base, service_worker: { filename, ...serviceWorkerParams }, env } = this.cx.params;
			this.#workport = new this.constructor.Workport(base + filename, { ...serviceWorkerParams, startMessages: true }, env);
		}
		// Window opener pinging
		if (window.opener) {
			window.addEventListener('beforeunload', () => {
				window.opener.postMessage('close');
			});
		}
		// Main initializations
		return super.initialize();
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
                this.host.history.replaceState({
                    ...(this.currentEntry()?.getState?.() || {}),
                    scrollPosition: this.host === window.document ? [window.scrollX, window.scrollY] : [this.host.scrollLeft, this.host.scrollTop,],
                }, '', this.location.href);
            } catch (e) { }
            // Do actual location update
            try { this.host.history.pushState({}, '', newHref); } catch (e) { }
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
		}
	}
}

const embedTagNames = 'webflo-embedded';
window.customElements.define(embedTagNames, class extends HTMLElement {

	#superController;
	#webfloControllerUninitialize;
	#location;

	static get observedAttributes() { return ['location']; }

	get location() {
		if (!this.#location) {
			this.#location = new URL(this.getAttribute('location') || '', window.location.origin);
		}
		return this.#location;
	}

	set location(value) {
		if (!(value instanceof URL)) {
			value = new URL(value, window.location.origin);
		}
		if (value.href === this.location.href) return;
		this.#location = value;
		this.setAttribute('location', value.href.replace(value.origin, ''));
		this.getWebfloControllerInstance().navigate(value);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		this.location = newValue;
	}

	connectedCallback() {
		this.#superController = (this.parentNode?.closest(embedTagNames) || document).getWebfloControllerInstance();
		this.#webfloControllerUninitialize = WebfloEmbedded.create(this, this.#superController).initialize();
	}

	disconnectedCallback() {
		this.#webfloControllerUninitialize();
	}
});
