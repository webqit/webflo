import { WebfloClient } from './WebfloClient.js';
import { Url } from './Url.js';

const { Observer } = webqit;

export class WebfloSubClient extends WebfloClient {

	static defineElement() {
		const embedTagNames = 'webflo-embedded';
		window.customElements.define(embedTagNames, class extends HTMLElement {
	
			#superRuntime;
			#webfloControllerUninitialize;
			#location;
			#reflectAction;
	
			static get observedAttributes() { return ['location']; }

			get startupFlight() {
				return this.hasAttribute('location');
			}
	
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
				if (!this.#reflectAction) {
					this.webfloRuntime.navigate(value);
				}
			}

			reflectLocation(location) {
				this.#reflectAction = true;
				this.location = location;
				this.#reflectAction = false;
			}
	
			attributeChangedCallback(name, oldValue, newValue) {
				if (oldValue === newValue) return;
				this.location = newValue;
			}
	
			connectedCallback() {
				this.#superRuntime = (this.parentNode?.closest(embedTagNames) || document).webfloRuntime;
				this.#webfloControllerUninitialize = WebfloSubClient.create(this, this.#superRuntime).initialize();
			}
	
			disconnectedCallback() {
				this.#webfloControllerUninitialize();
			}
		});
	}

	static create(host, superRuntime) {
        return new this(host, superRuntime);
    }

	#superRuntime;
	get superRuntime() { return this.#superRuntime; }
	
	get cx() { return this.#superRuntime.cx; }

	get workport() { return this.#superRuntime.workport; }

	constructor(host, superRuntime) {
		if (!(host instanceof HTMLElement)) {
			throw new Error('Argument #1 must be a HTMLElement instance');
		}
		super(host);
		if (!(superRuntime instanceof WebfloClient)) {
			throw new Error('Argument #2 must be a Webflo Client instance');
		}
		this.#superRuntime = superRuntime;
	}

	initialize() {
		if (this.host.location.origin !== window.location.origin) {
			throw new Error(`Webflo embeddable origin violation in "${window.location}"`);
		}
		const uncontrols = super.initialize();
		this.backgroundMessaging.setParent(this.#superRuntime.backgroundMessaging);
		this.navigate(this.location.href);
		return () => {
			if (this.backgroundMessaging.parentNode === this.#superRuntime.backgroundMessaging) {
				this.backgroundMessaging.setParent(null);
			}
			uncontrols();
		};
	}
	
	control() {
		return super.controlClassic((newHref) => {
			this.host.reflectLocation(newHref);
		});
	}

    reload(params) {
	}

	back() {
	}

	forward() {
	}

	traverseTo(...args) {
	}

	entries() {
	}

	currentEntry() {
	}

	async updateCurrentEntry(params, url = null) {
		this.host.reflectLocation(url);
	}

	async push(url, state = {}) {
	}

    hardRedirect(location, backgroundMessaging = null) {
        location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
        const width = Math.min(800, window.innerWidth);
		const height = Math.min(600, window.innerHeight);
		const left = (window.outerWidth - width) / 2;
		const top = (window.outerHeight - height) / 2;
		const popup = window.open(location, '_blank', `popup=true,width=${width},height=${height},left=${left},top=${top}`);
		if (backgroundMessaging) {
			Observer.set(this.navigator, 'redirecting', new Url/*NOT URL*/(location), { diff: true });
			backgroundMessaging.addEventListener('close', (e) => {
				Observer.set(this.navigator, 'redirecting', null);
				popup.postMessage('timeout:5');
				setTimeout(() => {
					popup.close();
				}, 5000);
			});
			window.addEventListener('message', (e) => {
				if (e.source === popup && e.data === 'close') {
					backgroundMessaging.close();
				}
			});
		}
    }

	async applyPostRenderState(httpEvent) {
		if (httpEvent.url.hash) {
			this.host.querySelector(httpEvent.url.hash)?.scrollIntoView();
		} else {
			this.host.scrollTo(0, 0);
		}
		(this.host.querySelector('[autofocus]') || this.host).focus();
	}
}