import { WebfloSubClient } from './WebfloSubClient.js';

const embedTagName = 'webflo-embedded';

export class WebfloEmbedded extends HTMLElement {

    #superRuntime;
    #lifecycleController;
    #location;
    #reflectAction;

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

    async connectedCallback() {
        this.#superRuntime = (this.parentNode?.closest(embedTagName) || document).webfloRuntime;
        this.#lifecycleController = await WebfloSubClient.create(this.#superRuntime, this).initialize();
    }

    disconnectedCallback() {
        this.#lifecycleController.abort();
    }
}

export function defineElement() {
    customElements.define(embedTagName, WebfloEmbedded);
}