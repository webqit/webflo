import { AbstractController } from './AbstractController.js';

const { Observer } = webqit;

export class WebfloEmbedded extends AbstractController {

	static defineElement() {
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
				// "Startup" navigation would stop at the check below this line.
				// But we need this to be updated
				this.querySelector('base[auto]').setAttribute('href', value.pathname);
				if (value.href === this.location.href) return;
				this.#location = value;
				this.setAttribute('location', value.href.replace(value.origin, ''));
				this.getWebfloControllerInstance().navigate(value);
			}

			constructor() {
				super();
				this.attachShadow({ mode: 'open' });
			}
	
			attributeChangedCallback(name, oldValue, newValue) {
				if (oldValue === newValue) return;
				this.location = newValue;
			}
	
			connectedCallback() {
				this.#superController = (this.parentNode?.closest(embedTagNames) || document).getWebfloControllerInstance();
				this.#webfloControllerUninitialize = WebfloEmbedded.create(this, this.#superController).initialize();
				this.shadowRoot.innerHTML = `<slot></slot>`;
			}
	
			disconnectedCallback() {
				this.#webfloControllerUninitialize();
			}
		});
	}

	static create(host, superController) {
        return new this(host, superController);
    }

	#superController;
	get superController() { return this.#superController; }
	
	get cx() { return this.#superController.cx; }

	get workport() { return this.#superController.workport; }

	constructor(host, superController) {
		if (!(host instanceof HTMLElement)) {
			throw new Error('Argument #1 must be a HTMLElement instance');
		}
		super(host);
		if (!(superController instanceof AbstractController)) {
			throw new Error('Argument #2 must be a Webflo Controller instance');
		}
		this.#superController = superController;
	}

	initialize() {
		if (this.host.location.origin !== window.location.origin) {
			throw new Error(`Webflo embeddable origin violation in "${window.location}"`);
		}
		return super.initialize();
	}
	
	control() {
		return super.controlClassic((newHref) => {
			this.host.location = newHref;
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
	}

	async push(url, state = {}) {
	}

    hardRedirect(location) {
        location = typeof location === 'string' ? new URL(location, this.location.origin) : location;
		const currentRdr = this.navigator.redirecting?.href;
		if (location.href === currentRdr) return;
        Observer.set(this.navigator, 'redirecting', location, { diff: true });
        const width = Math.min(800, window.innerWidth);
		const height = Math.min(600, window.innerHeight);
		const left = (window.outerWidth - width) / 2;
		const top = (window.outerHeight - height) / 2;
		const popup = window.open(location, '_blank', `popup=true,width=${width},height=${height},left=${left},top=${top}`);
		const signal = Observer.observe(this.navigator, 'redirecting', (e) => {
			if (e.value?.href !== currentRdr) {
				signal.abort();
				setTimeout(() => popup.close(), 0);
			}
		});
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