// ---------------- BaseElement

export class BaseElement extends HTMLElement {

    static get events() {
        return [];
    }

    static get observedAttributes() {
        return this.events.map((e) => `on${e}`);
    }

    // ----------------

    #compiledEventHandlers = {};

    #compileAttrEventsIfNeeded(attrName, attrValue) {
        for (const eventName of this.constructor.events) {

            if (attrName !== `on${eventName}`) continue;

            if (this.#compiledEventHandlers[attrName]) {
                this.removeEventListener(eventName, this.#compiledEventHandlers[attrName]);
                this.#compiledEventHandlers[attrName] = null;
            }

            if (attrValue) {
                this.#compiledEventHandlers[attrName] = Function('event', attrValue).bind(this);
                this.addEventListener(eventName, this.#compiledEventHandlers[attrName]);
            }
        }
    }

    #initPropEventsSystem() {
        for (const eventName of this.constructor.events) {

            const attrName = `on${eventName}`;
            let _handler = null;

            Object.defineProperty(this, attrName, {
                get: () => _handler,
                set: (handler) => {
                    if (_handler) {
                        this.removeEventListener(eventName, _handler);
                        _handler = null;
                    }

                    if (typeof handler === 'function') {
                        this.addEventListener(eventName, handler);
                    } else if (handler !== null && handler !== undefined) {
                        throw new Error(`[${attrName}] handler must be null or a function`);
                    }

                    _handler = handler;
                }
            });
        }
    }

    // ----------------

    attributeChangedCallback(name, old, _new) {
        this.#compileAttrEventsIfNeeded(name, _new);
    }

    constructor() {
        super();
        this.#initPropEventsSystem();
    }
}

// ---------------- ToastElement

export class ToastElement extends BaseElement {

    set type(value) {
        if ([undefined, null].includes(value)) {
            this.removeAttribute('type');
        } else this.setAttribute('type', value);
    }

    get type() { return this.getAttribute('type'); }

    get contentHTML() { return ''; }

    get css() { return ''; }

    #childToast = null;

    #addNested() {
        if (this.#childToast) {
            this.shadowRoot.appendChild(this.#childToast);
            if (this.matches(':popover-open')) {
                this.#childToast.showPopover();
            }
        }
    }

    _processVisibility(slot) {
        if (this.hasAttribute('oncontent')) {
            if (slot.assignedNodes().find((n) => n.nodeName !== '#text' || n.textContent.trim())) {
                this.showPopover();
            } else this.hidePopover();
        }
    }

    render({ content, context }, childToast = null, recursion = 1) {
        if (context && recursion > 0) {
            const directChildToast = document.createElement(this.tagName);

            directChildToast.setAttribute('popover', this.getAttribute('popover') || 'auto');
            if (this.classList.contains('_top')) {
                directChildToast.classList.add('_top');
            }
            directChildToast.render({ content }, childToast, 0);

            this.render(context, directChildToast, recursion + 1);
            return;
        }

        this.#childToast?.remove();
        this.#childToast = childToast;
        // In case "this" is already connected
        this.#addNested();

        const childStartDelay = parseFloat(childToast?.style.getPropertyValue('--start-delay') || '0');
        this.style.setProperty('--start-delay', (childStartDelay + 0.1) + 's');

        // Render now
        this.type = content.type;
        this.innerHTML = content.message;
    }

    connectedCallback() {
        if (!this.popover) {
            this.popover = 'auto';
        }
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.addEventListener('toggle', (e) => {
            if (e.newState === 'open') {
                this.#childToast?.showPopover();
            } else if (e.newState === 'closed') {
                this.#childToast?.hidePopover();
                if (this.getAttribute('oncontent') === 'always') {
                    this.innerHTML = '';
                }
            }
        });

        this.shadowRoot.innerHTML = `
        <div class="container">

            <svg class="icon _info" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M444-296h72v-228h-72v228Zm36-312q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm0 528q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
            <svg class="icon _success" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M390-298 246-442l72-72 72 72 252-252 72 72-324 324Zm90 218q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
            <svg class="icon _error" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-292q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm-36-156h72v-240h-72v240Zm36 368q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
            <svg class="icon _warning" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-292q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm-36-156h72v-240h-72v240Zm36 368q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
            <div class="_content" part="content">
                <slot
                    onslotchange="this.getRootNode().host?._processVisibility(this);"
                >${this.contentHTML}</slot>
            </div>
            <button class="close-button" part="close-button" onclick="this.getRootNode().host.hidePopover();">
                <svg xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M256-176 176-256l224-224-224-224 80-80 224 224 224-224 80 80-224 224 224 224-80 80-224-224-224 224Z"/></svg>
            </button>

        </div>
        <style>
            * {
                box-sizing: border-box;
            }
            
            @keyframes flash {
                from {
                    background-color: transparent;
                }

                50% {
                    background-color: rgba(125, 125, 125, 0.2);
                }

                to {
                    background-color: transparent;
                }
            }

            :host {
                --color-default: var(--toast-color-default, whitesmoke);
                --color-info: var(--toast-color-info, skyblue);
                --color-success: var(--toast-color-success, lightgreen);
                --color-error: var(--toast-color-error, coral);
                --color-warning: var(--toast-color-warning, coral);

                --radius: var(--toast-radius, 1rem);
                --background: var(--toast-background, rgb(30, 30, 30));
                --shadow: var(--toast-shadow, rgb(30, 30, 30));

                --entry-translation-polarity: var(--toast-entry-translation-polarity, 1);
                --translation: calc(var(--toast-translation, 50px) * var(--entry-translation-polarity));
                --exit-translation-polarity: var(--toast--exit-translation-polarity, -1);

                --entry-transform: translateY(var(--translation));
                --exit-transform: translateY(calc(var(--translation) * var(--exit-translation-polarity)));
            }

            :host {
                border: none;
                background: none;

                margin-bottom: 0;
                padding: 1rem;

                /* Transition */
                transition:
                    opacity 0.2s,
                    transform 0.2s,
                    bottom 0.1s,
                    top 0.1s,
                    overlay 0.2s allow-discrete,
                    display 0.2s allow-discrete;
                
                /* Exit state */
                transform: var(--exit-transform);
                transition-delay: var(--start-delay, 0s);
                opacity: 0;
            }
            
            :host(._top) {
                margin-bottom: auto;
                margin-top: 0;
                --entry-translation-polarity: var(--toast-entry-translation-polarity, -1);
            }

            /* ----------- */

            .container {
                position: relative;

                display: flex;
                align-items: start;
                gap: 0.6rem;

                padding-block: 0.8rem;
                padding-inline: 1.2rem;
                border-radius: var(--radius);

                color: var(--color-default);
                background-color: var(--background);
                box-shadow: var(--shadow);

                anchor-name: --container;
            }

            /* ----------- */

            :host(:popover-open) {
                display: block;
                opacity: 1;
                transform: none;
            }

            @starting-style {
                :host(:popover-open) {
                    opacity: 0;
                    transform: var(--entry-transform);
                }
            }

            /* ----------- */

            :host(:not([popover="manual"], ._manual-dismiss):popover-open)::backdrop {
                animation: flash 0.3s ease-in;
                animation-iteration-count: 3;
            }

            :host(:is([popover="manual"], ._manual-dismiss))::backdrop {
                /* Transition */
                transition:
                    display 0.2s allow-discrete,
                    overlay 0.2s allow-discrete,
                    backdrop-filter 0.2s,
                    background 0.2s;
            }

            :host(:is([popover="manual"], ._manual-dismiss):popover-open)::backdrop {
                backdrop-filter: blur(3px);
            }

            @starting-style {
                :host(:is([popover="manual"], ._manual-dismiss):popover-open)::backdrop {
                    backdrop-filter: none;
                    background: none;
                }
            }
            
            :host(:is([popover="manual"], ._manual-dismiss):popover-open)::before {
                position: fixed;
                inset: 0;
                display: block;
                content: "";
                z-index: -1;
            }

            .icon {
                display: none;
                opacity: 0.6;
            }

            :host([type="info"]) .icon._info,
            :host([type="success"]) .icon._success,
            :host([type="error"]) .icon._error,
            :host([type="warning"]) .icon._warning {
                display: block;
            }
            
            :host([type="info"]) .container {
                color: var(--color-info);
            }
            
            :host([type="success"]) .container {
                color: var(--color-success);
            }

            :host([type="error"]) .container {
                color: var(--color-error);
            }

            :host([type="warning"]) .container {
                color: var(--color-warning);
            }

            .close-button {
                padding-inline: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                appearance: none;
                font-size: inherit;
                color: gray;
                cursor: pointer;
                border: none;
                background: none;
                transform: translateX(0.1rem);
            }

            :host(:not([popover="manual"], ._manual-dismiss)) .close-button {
                display: none;
            }

            .close-button:hover {
                opacity: 0.8;
            }

            /* ----------- */

            :host(:not(._top)) wq-toast {
                position-anchor: --container;
                bottom: calc(anchor(bottom) - 0.5rem);
            }

            :host(:not(._top)) wq-toast:hover,
            :host(:not(._top)) .container:hover ~ wq-toast {
                bottom: calc(anchor(top) - 0.75rem);
                transition-delay: 0;
            }

            :host(._top) wq-toast {
                position-anchor: --container;
                top: calc(anchor(top) - 0.5rem);
            }

            :host(._top) wq-toast:hover,
            :host(._top) .container:hover ~ wq-toast {
                top: calc(anchor(bottom) - 0.75rem);
                transition-delay: 0;
            }
            
            ${this.css}
        </style>`;

        this.#addNested();
    }
}

// ---------------- ModalElement

export class ModalMinmaxEvent extends Event {

    #ratio;
    get ratio() { return this.#ratio; }

    constructor(ratio) {
        super('minmax');
        this.#ratio = ratio;
    }
}

export class ModalElement extends BaseElement {

    static get events() {
        return super.events.concat(['minmax']);
    }

    static get observedAttributes() {
        return super.observedAttributes.concat(['class']);
    }

    get delegatesFocus() { return false; }
    get autoFocus() { return true; }

    // ----------------

    set type(value) {
        if ([undefined, null].includes(value)) {
            this.removeAttribute('type');
        } else this.setAttribute('type', value);
    }

    get type() { return this.getAttribute('type'); }

    get headerBoxHTML() { return ''; }

    get headerHTML() { return ''; }

    get headerExtendedHTML() { return ''; }

    get mainHTML() { return ''; }

    get contentHTML() { return ''; }

    get footerHTML() { return ''; }

    get css() { return ''; }

    #viewElement;
    #sentinelElement;
    #spacingElement;
    #headerElement;
    #headerBoxElement;
    #footerElement;

    _calcViewDimensions() {
        const viewWidth = this.#viewElement.offsetWidth;
        const viewHeight = this.#viewElement.offsetHeight;
        this.style.setProperty('--view-width', viewWidth + 'px');
        this.style.setProperty('--view-height', viewHeight + 'px');
    }

    _calcHeaderDimensions() {
        this.style.setProperty('--header-box-height', this.#headerBoxElement.offsetHeight + 'px');
        this.style.setProperty('--header-max-height', this.#headerElement.offsetHeight + 'px');
    }

    _calcFooterDimensions() {
        this.style.setProperty('--footer-max-height', this.#footerElement.offsetHeight + 'px');
    }

    _calcScrollability() {
        this.style.setProperty('--view-scroll-height', this.#viewElement.scrollHeight + 'px');
        this.style.setProperty('--view-scroll-width', this.#viewElement.scrollWidth + 'px');
    }

    _updateScrollViewDimensions() {
        requestAnimationFrame(() => {
            const swipeDismiss = this.classList.contains('_swipe-dismiss');
            const minmaxScroll = !!window.getComputedStyle(this).getPropertyValue('--modal-minmax-length');

            if (swipeDismiss || minmaxScroll) {
                requestAnimationFrame(() => {
                    let left = 0, top = 0;
                    if (this.matches('._left._horz, ._top:not(._horz)')) {
                        this.#viewElement.scrollTo({ top, left });
                    } else {
                        if (this.classList.contains('_horz')) {
                            left = this.#sentinelElement.offsetWidth;
                        } else {
                            top = this.#sentinelElement.offsetHeight;
                        }
                        if (this.#viewElement.scrollTop < top || this.#viewElement.scrollLeft < left) {
                            this.#viewElement.scrollTo({ top, left });
                        }
                    }
                });
            }

            this._calcHeaderDimensions();
            this._calcFooterDimensions();
            this._calcScrollability();
            if (this.classList.contains('_container')) return;
            this._calcViewDimensions();
        });
    }

    #unbindMinmaxWorker = null;

    _bindMinmaxWorker() {
        const swipeDismiss = this.classList.contains('_swipe-dismiss');
        const minmaxEvents = this.classList.contains('_minmax-events');

        if (!swipeDismiss && !minmaxEvents) return;

        const options = {
            root: this.#viewElement,
            threshold: [0, 1]
        };

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                // Minmax events
                if (entry.target === this.#spacingElement) {
                    const event = new ModalMinmaxEvent(1 - entry.intersectionRatio);
                    this.dispatchEvent(event);
                }

                // For auto-closing
                if (this.#userScrolled
                    && entry.target === this.#sentinelElement
                    && entry.isIntersecting
                    && entry.intersectionRatio >= 0.8) {
                    this.hidePopover();
                }
            }
        }, options);

        setTimeout(() => {
            if (minmaxEvents) observer.observe(this.#spacingElement);
            if (swipeDismiss) observer.observe(this.#sentinelElement);
        }, 200);

        this.#unbindMinmaxWorker = () => observer.disconnect();
    }

    #userScrolled = false;
    #unbindDimensionsWorker;

    #bindDimensionsWorker() {
        this.#userScrolled = false;
        const handleUserScroll = () => this.#userScrolled = true;
        this.#viewElement.addEventListener('scroll', handleUserScroll);

        this._updateScrollViewDimensions();
        const handleResize = () => this._updateScrollViewDimensions();
        window.addEventListener('resize', handleResize);

        this.#unbindDimensionsWorker?.();
        this.#unbindDimensionsWorker = () => {
            window.removeEventListener('resize', handleResize);
            this.#viewElement.removeEventListener('scroll', handleUserScroll);
        };
    }

    // ----------------

    attributeChangedCallback(name, old, _new) {
        super.attributeChangedCallback?.(name, old, _new);

        if (name === 'class' && old !== _new) this.#bindDimensionsWorker();
    }

    connectedCallback() {
        super.connectedCallback?.();

        if (!this.popover) {
            this.popover = 'manual';
        }
        if (this.hasAttribute('open')) {
            this.showPopover();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();

        this.#unbindDimensionsWorker?.();
        this.#unbindDimensionsWorker = null;
        this.#unbindMinmaxWorker?.();
        this.#unbindMinmaxWorker = null;
    }

    constructor() {
        super();

        this.attachShadow({ mode: 'open', delegatesFocus: this.delegatesFocus });

        this.addEventListener('toggle', (e) => {
            if (e.newState === 'open') {

                // Hack for chrome to force animation rebind on each open phase
                const isBlink =
                    CSS.supports('selector(:has(*))') &&
                    'chrome' in globalThis &&
                    !('safari' in globalThis);
                if (isBlink) {
                    this.style.animation = 'none';
                    this.offsetHeight; // force style + layout flush
                    this.style.animation = '';
                }

                this.#bindDimensionsWorker();
                this._bindMinmaxWorker();

                if (!this.delegatesFocus && this.autoFocus
                    && !this.querySelector('[autofocus]')) {
                    this.shadowRoot.querySelector('[autofocus]')?.focus();
                }
            } else if (e.newState === 'closed') {
                this.#unbindDimensionsWorker?.();
                this.#unbindDimensionsWorker = null;
                this.#unbindMinmaxWorker?.();
                this.#unbindMinmaxWorker = null;
            }
        });

        this.shadowRoot.innerHTML = `
        <div class="spacing"></div>
        <div class="view" part="view">

            <div class="sentinel"></div>
            <div class="spacing"></div>

            <div class="container" part="container">
                <header part="header">
                    <div class="header-box" part="header-box">
                        <slot
                            name="header-box"
                            onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length); this.getRootNode().host._calcHeaderDimensions();"
                        >${this.headerBoxHTML}</slot>
                    </div>

                    <div class="header-bar" part="header-bar">
                        <div class="header-left">
                            <svg class="icon _info" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M444-296h72v-228h-72v228Zm36-312q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm0 528q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                            <svg class="icon _success" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M390-298 246-442l72-72 72 72 252-252 72 72-324 324Zm90 218q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                            <svg class="icon _error" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-292q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm-36-156h72v-240h-72v240Zm36 368q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                            <svg class="icon _warning" xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-292q20 0 33-13t13-33q0-20-13-33t-33-13q-20 0-33 13t-13 33q0 20 13 33t33 13Zm-36-156h72v-240h-72v240Zm36 368q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                            <div class="_content" style="flex-grow: 1">
                                <slot
                                    name="header"
                                    onslotchange="this.getRootNode().host._calcHeaderDimensions();"
                                >${this.headerHTML}</slot>
                            </div>
                        </div>
                        <button class="close-button" part="close-button" onclick="this.getRootNode().host.hidePopover();">
                            <svg xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M256-176 176-256l224-224-224-224 80-80 224 224 224-224 80 80-224 224 224 224-80 80-224-224-224 224Z"/></svg>
                        </button>
                    </div>

                    ${this.headerExtendedHTML || `
                        <slot
                            name="header-extended"
                            onslotchange="this.getRootNode().host._calcHeaderDimensions();"
                        ></slot>`}

                </header>

                <div class="scrollport-anchor">
                    <div class="scrollport">
                        <div class="scroll-fold scroll-fold-start" part="scroll-fold scroll-fold-start"></div>
                        <div class="scroll-fold scroll-fold-end" part="scroll-fold scroll-fold-end"></div>
                        <div class="scrollbar-track">
                            <div class="scrollbar-thumb"></div>
                        </div>
                    </div>
                </div>

                ${this.mainHTML || `<div class="main" part="main">${this.contentHTML || `
                    <slot onslotchange="this.getRootNode().host._calcScrollability();"></slot>`
                }</div>`}

                <footer part="footer">
                    <div class="footer-bar" part="footer-bar">
                        <slot
                            name="footer"
                            onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length); this.getRootNode().host._calcFooterDimensions();"
                        >${this.footerHTML}</slot>
                    </div>
                </footer>

            </div>
        </div>
        <span class="spacing-b"></span>

        <style>
            /*
             * Start: resets
             */

            * {
                box-sizing: border-box;
            }

            /*
             * End: resets
             * Start: general vars
             */

            :host {
                --aero-blur: var(--modal-aero-blur, 10px);
                --backdrop-filter: var(--modal-backdrop-filter, blur(3px));
                
                --radius-length: var(--modal-radius, 1rem);

                --background: var(--modal-background, rgba(80, 80, 80, 1));

                --background-accent: var(--modal-background-accent, var(--background));
                --color-accent: var(--modal-color-accent, var(--color-default));

                --color-default: var(--modal-color-default, whitesmoke);
                --color-info: var(--modal-color-info, whitesmoke);
                --color-success: var(--modal-color-success, whitesmoke);
                --color-error: var(--modal-color-error, whitesmoke);
                --color-warning: var(--modal-color-warning, whitesmoke);

                --header-color-default: var(--modal-header-color-default, var(--color-default));
                --header-color-info: var(--modal-header-color-info, skyblue);
                --header-color-success: var(--modal-header-color-success, lightgreen);
                --header-color-error: var(--modal-header-color-error, coral);
                --header-background: var(--modal-header-background, var(--background));

                --header-open-background: var(--modal-header-open-background, var(--header-background));

                --footer-color-default: var(--modal-footer-color-default, var(--color-default));
                --footer-color-info: var(--modal-footer-color-info, skyblue);
                --footer-color-success: var(--modal-footer-color-success, lightgreen);
                --footer-color-error: var(--modal-footer-color-error, coral);
                --footer-background: var(--modal-footer-background, var(--background));

                --close-button-color: var(--modal-close-button-color, var(--color-default));

                --expanse-length: var(--modal-expanse-length, 0px);
                --minmax-length: var(--modal-minmax-length, 0px);

                --scrollbar-thumb-color: var(--modal-scrollbar-thumb-color, black);
                --scrollbar-thumb-width: var(--modal-scrollbar-thumb-width, 4px);
                --scrollbar-thumb-height: var(--modal-scrollbar-thumb-height, 30px);

                --entry-exit-translation: calc(var(--modal-translation, 50px) * var(--entry-translation-polarity));
                --exit-translation-polarity: var(--modal-exit-translation-polarity, -1);

                /* -------- box lengths -------- */

                --header-max-height: 1.6rem;
                --header-box-height: 0px;
                --footer-max-height: 0px;

                --header-min-height: calc(var(--header-max-height) - var(--header-box-height));
                --footer-min-height: var(--footer-max-height);

                --view-inner-height: calc(var(--view-height) - var(--header-min-height) - var(--footer-min-height));
                
                --total-minmax-length: calc(var(--minmax-length) + var(--swipe-dismiss-length, 0));
            }

            :host(._container:not(._horz)) {
                --view-height: calc(100cqh - var(--expanse-length));
                --view-width: 100cqw;
            }

            :host(._container._horz) {
                --view-height: 100cqh;
                --view-width: calc(100cqw - var(--expanse-length));
            }

            /*
             * End: general vars
             * Start: entry/exit transition
            */

            :host { --entry-translation-polarity: var(--modal-entry-translation-polarity, 1); }
            :host(:is(._top, ._left)) { --entry-translation-polarity: var(--modal-entry-translation-polarity, -1); }
            :host(._edge-tight) { --exit-translation-polarity: var(--modal-exit-translation-polarity, 1); }
            :host(:not([popover="manual"], ._manual-dismiss):popover-open) { --backdrop-filter: blur(0px); }
                
            :host {
                --entry-transform: translateY(var(--entry-exit-translation));
                --exit-transform: translateY(calc(var(--entry-exit-translation) * var(--exit-translation-polarity)));
            }

            :host(:is(._left, ._right, ._horz)) {                
                --entry-transform: translateX(var(--entry-exit-translation));
                --exit-transform: translateX(calc(var(--entry-exit-translation) * var(--exit-translation-polarity)));
            }

            /* ----------- */

            :host {
                transition:
                    opacity 0.2s,
                    transform 0.2s,
                    overlay 0.2s allow-discrete,
                    display 0.2s allow-discrete;
                transition-timing-function: ease-out;
                
                transform: var(--exit-transform);
                opacity: 0;
            }

            :host(:popover-open) {
                display: flex;
                opacity: 1;
                transform: none;
            }

            @starting-style {
                :host(:popover-open) {
                    opacity: 0;
                    transform: var(--entry-transform);
                }
            }

            /* ----------- */

            :host::backdrop {
                transition:
                    display 0.2s allow-discrete,
                    overlay 0.2s allow-discrete,
                    backdrop-filter 0.2s,
                    background 0.2s;
            }

            :host(:popover-open)::backdrop {
                backdrop-filter: var(--backdrop-filter);
            }

            @starting-style {
                :host(:popover-open)::backdrop {
                    backdrop-filter: none;
                    background: none;
                }
            }

            :host(:not([popover="manual"], ._manual-dismiss):popover-open)::backdrop {
                backdrop-filter: blur(0px);
            }

            /*
             * End: entry/exit transition
             * Start: scroll-driven animations
            */

            @keyframes radius-progress {
                from { --wq-internal-var-radius-progress: 0; }
                to { --wq-internal-var-radius-progress: 1; }
            }

            @keyframes header-box-progress {
                from { --wq-internal-var-header-box-progress: 0; }
                to { --wq-internal-var-header-box-progress: 1; }
            }

            @keyframes header-box-progress-a {
                from { --wq-internal-var-header-box-progress-a: 0; }
                to { --wq-internal-var-header-box-progress-a: 1; }
            }

            @keyframes header-box-progress-b {
                from { --wq-internal-var-header-box-progress-b: 0; }
                to { --wq-internal-var-header-box-progress-b: 1; }
            }

            @keyframes minmax-progress {
                from { --wq-internal-var-minmax-progress: 0; }
                to { --wq-internal-var-minmax-progress: 1; }
            }

            @keyframes minmax-progress-a {
                from { --wq-internal-var-minmax-progress-a: 0; }
                to { --wq-internal-var-minmax-progress-a: 1; }
            }

            @keyframes minmax-progress-b {
                from { --wq-internal-var-minmax-progress-b: 0; }
                to { --wq-internal-var-minmax-progress-b: 1; }
            }

            @keyframes total-minmax-progress {
                from { --wq-internal-var-total-minmax-progress: 0; }
                to { --wq-internal-var-total-minmax-progress: 1; }
            }

            @keyframes swipe-dismiss-progress {
                from { --wq-internal-var-swipe-dismiss-progress: 0; }
                to { --wq-internal-var-swipe-dismiss-progress: 1; }
            }

            @keyframes scrollbar-appear-progress {
                from { --wq-internal-var-scrollbar-appear-progress: 0; }
                to { --wq-internal-var-scrollbar-appear-progress: 1; }
            }

            @keyframes scrollbar-progress {
                from { --wq-internal-var-scrollbar-progress: 0; }
                to { --wq-internal-var-scrollbar-progress: 1; }
            }

            @keyframes scrollbar-progress-a {
                from { --wq-internal-var-scrollbar-progress-a: 0; }
                to { --wq-internal-var-scrollbar-progress-a: 1; }
            }

            @keyframes scrollbar-progress-b {
                from { --wq-internal-var-scrollbar-progress-b: 0; }
                to { --wq-internal-var-scrollbar-progress-b: 1; }
            }

            :host {
                timeline-scope: --view-scroll;
                animation-timeline: --view-scroll;

                animation-timing-function: linear;
                animation-fill-mode: both;
                
                animation-name:
                    radius-progress,
                    header-box-progress,
                    header-box-progress-a,
                    header-box-progress-b,
                    minmax-progress,
                    minmax-progress-a,
                    minmax-progress-b,
                    total-minmax-progress,
                    swipe-dismiss-progress,
                    scrollbar-appear-progress,
                    scrollbar-progress,
                    scrollbar-progress-a,
                    scrollbar-progress-b;

                animation-range:
                    var(--radius-progress-range, 0 0),
                    var(--header-box-progress-range, 0 0),
                    var(--header-box-progress-range-a, 0 0),
                    var(--header-box-progress-range-b, 0 0),
                    var(--minmax-progress-range, 0 0),
                    var(--minmax-progress-range-a, 0 0),
                    var(--minmax-progress-range-b, 0 0),
                    var(--total-minmax-progress-range, 0 0),
                    var(--swipe-dismiss-progress-range, 0 0),
                    var(--scrollbar-appear-range, 0 0),
                    var(--scrollbar-progress-range, 0 0),
                    var(--scrollbar-progress-range-a, 0 0),
                    var(--scrollbar-progress-range-b, 0 0);

                animation-direction:
                    var(--radius-progress-direction, normal),
                    var(--header-box-progress-direction, normal),
                    var(--header-box-progress-direction-a, normal),
                    var(--header-box-progress-direction-b, normal),
                    var(--minmax-progress-direction, normal),
                    var(--minmax-progress-direction-a, normal),
                    var(--minmax-progress-direction-b, normal),
                    var(--total-minmax-progress-direction, normal),
                    var(--swipe-dismiss-progress-direction, normal),
                    var(--scrollbar-appear-direction, normal),
                    var(--scrollbar-progress-direction, normal),
                    var(--scrollbar-progress-direction-a, normal),
                    var(--scrollbar-progress-direction-b, normal);
            }

            /* ----------- radius ----------- */

            :host(._edge-tight._alt-edge-tight:not(._top:not(._horz), ._left._horz)) {
                --radius-progress-range:
                    calc(var(--total-minmax-length) - var(--radius-length))
                    var(--total-minmax-length);
            }

            :host(._edge-tight._alt-edge-tight:is(._top:not(._horz), ._left._horz)) {
                --radius-progress-range:
                    calc(100% - var(--total-minmax-length))
                    calc(100% - (var(--total-minmax-length) - var(--radius-length)));
                --radius-progress-direction: reverse;
            }

            :host(._edge-tight._alt-edge-tight) {
                --effective-radius: calc(var(--radius-length) * (1 - var(--wq-internal-var-radius-progress)));
            }

            :host(:not(._edge-tight._alt-edge-tight)) {
                --effective-radius: var(--radius-length);
            }

            :host {
                --effective-top-left-radius: var(--effective-radius);
                --effective-top-right-radius: var(--effective-radius);
                --effective-bottom-left-radius: var(--effective-radius);
                --effective-bottom-right-radius: var(--effective-radius);
            }

            :host(._top._edge-tight) {
                --effective-top-left-radius: 0px;
                --effective-top-right-radius: 0px;
            }

            :host(._bottom._edge-tight) {
                --effective-bottom-left-radius: 0px;
                --effective-bottom-right-radius: 0px;
            }

            :host(._left._edge-tight) {
                --effective-top-left-radius: 0px;
                --effective-bottom-left-radius: 0px;
            }

            :host(._right._edge-tight) {
                --effective-top-right-radius: 0px;
                --effective-bottom-right-radius: 0px;
            }

            .view {
                border-top-left-radius: var(--effective-top-left-radius);
                border-top-right-radius: var(--effective-top-right-radius);
                border-bottom-left-radius: var(--effective-bottom-left-radius);
                border-bottom-right-radius: var(--effective-bottom-right-radius);
            }

            header {
                border-top-left-radius: var(--effective-top-left-radius);
                border-top-right-radius: var(--effective-top-right-radius);
            }

            .view:not(:has(footer slot:is(.has-slotted, :not(:empty)))) .main {
                border-bottom-left-radius: var(--effective-bottom-left-radius);
                border-bottom-right-radius: var(--effective-bottom-right-radius);
            }

            footer {
                border-bottom-left-radius: var(--effective-bottom-left-radius);
                border-bottom-right-radius: var(--effective-bottom-right-radius);
            }

            /* ----------- minmax ----------- */

            :host {
                --minmax-progress-range: var(--minmax-progress-range-start) var(--minmax-progress-range-end);
                --minmax-progress-range-start: 0%;
                --minmax-progress-range-end: var(--minmax-length);

                --minmax-progress-range-a: var(--minmax-progress-range-a-start) var(--minmax-progress-range-a-end);
                --minmax-progress-range-a-start: var(--minmax-progress-range-start);
                --minmax-progress-range-a-end: calc(var(--minmax-progress-range-start) + (var(--minmax-progress-range-end) - var(--minmax-progress-range-start)) / 2);

                --minmax-progress-range-b: var(--minmax-progress-range-b-start) var(--minmax-progress-range-b-end);
                --minmax-progress-range-b-start: calc(var(--minmax-progress-range-start) + (var(--minmax-progress-range-end) - var(--minmax-progress-range-start)) / 2);
                --minmax-progress-range-b-end: var(--minmax-progress-range-end);

                --total-minmax-progress-range: var(--total-minmax-progress-range-start) var(--total-minmax-progress-range-end);
                --total-minmax-progress-range-start: 0%;
                --total-minmax-progress-range-end: var(--total-minmax-length);
            }
                
            :host(:is(._top:not(._horz), ._left._horz)) {
                --minmax-progress-range-start: calc(100% - var(--minmax-length));
                --minmax-progress-range-end: 100%;

                --total-minmax-progress-range-start: calc(100% - var(--total-minmax-length));
                --total-minmax-progress-range-end: 100%;
            }

            :host {
                --effective-minmax-balance-offset: calc(var(--total-minmax-length) / -2 * (1 - var(--wq-internal-var-total-minmax-progress)));
            }

            :host(:not(._horz, ._top, ._bottom)) .view {
                transform: translateY(var(--effective-minmax-balance-offset));
            }

            :host(._horz:not(._left, ._right)) .view {
                transform: translateX(var(--effective-minmax-balance-offset));
            }

            /* ----------- swipe-dismiss ----------- */
            
            :host(:not(._swipe-dismiss)) {
                --swipe-dismiss-length: 0px;
            }

            :host(._swipe-dismiss:not(._horz)) {
                --swipe-dismiss-length: var(--modal-swipe-dismiss-length, calc(var(--view-height) - var(--minmax-length)));
            }

            :host(._swipe-dismiss._horz) {
                --swipe-dismiss-length: var(--modal-swipe-dismiss-length, calc(var(--view-width) - var(--minmax-length)));
            }

            :host(._swipe-dismiss:not(._top:not(._horz), ._left._horz)) {
                --swipe-dismiss-progress-range: 0% var(--swipe-dismiss-length);
            }

            :host(._swipe-dismiss:is(._top:not(._horz), ._left._horz)) {
                --swipe-dismiss-progress-range:
                    calc(100% - var(--swipe-dismiss-length))
                    100%;
                --swipe-dismiss-progress-direction: reverse;
            }

            :host(._swipe-dismiss) {
                --effective-swipe-dismiss-opacity: calc(1 * var(--wq-internal-var-swipe-dismiss-progress));
            }

            :host(._swipe-dismiss)::backdrop,
            :host(._swipe-dismiss._swipe-dismiss-fadeout) .view {
                opacity: var(--effective-swipe-dismiss-opacity);
            }

            /* ----------- header-box ----------- */

            :host(:not(._horz)) {
                --header-box-progress-range:
                    var(--total-minmax-length)
                    calc(var(--total-minmax-length) + var(--header-box-height));

                --header-box-progress-range-a:
                    var(--total-minmax-length)
                    calc(var(--total-minmax-length) + (var(--header-box-height) / 2));

                --header-box-progress-range-b:
                    calc(var(--total-minmax-length) + (var(--header-box-height) / 2))
                    calc(var(--total-minmax-length) + var(--header-box-height));

                --effective-header-box-progress-transform: translateY(calc(35% * var(--wq-internal-var-header-box-progress-a)));
                --effective-header-box-progress-a-opacity: calc(1 * (1 - var(--wq-internal-var-header-box-progress-a)));
                --effective-header-box-progress-b-opacity: calc(1 * var(--wq-internal-var-header-box-progress-b));

                .header-box {
                    transform: var(--effective-header-box-progress-transform);
                    opacity: var(--effective-header-box-progress-a-opacity);
                }
                
                .header-left {
                    opacity: var(--effective-header-box-progress-b-opacity);
                }
            }

            /* ----------- scrollbars and scroll-unfold ----------- */

            :host(:is(._scrollbars, ._scroll-unfold, ._horz)) {
                --scrollable-length: calc(var(--view-scroll-width) - var(--total-minmax-length) - var(--view-width));
            }

            :host(:is(._scrollbars, ._scroll-unfold):not(._horz)) {
                --scrollable-length: calc(var(--view-scroll-height) - var(--total-minmax-length) - var(--header-box-height) - var(--view-height));
            }

            :host(:is(._scrollbars, ._scroll-unfold)) {
                --scrollability: calc(1 * min(1, calc(var(--scrollable-length) / 1px)));
            }

            :host {
                --scrollbar-appear-range: var(--scrollbar-appear-range-start) var(--scrollbar-appear-range-end);
                --scrollbar-appear-range-start: calc(var(--total-minmax-length) - 25px);
                --scrollbar-appear-range-end: var(--total-minmax-length);

                --scrollbar-progress-range: var(--scrollbar-progress-range-start) var(--scrollbar-progress-range-end);
                --scrollbar-progress-range-start: var(--total-minmax-length);
                --scrollbar-progress-range-end: 100%;

                --scrollbar-progress-range-a: var(--scrollbar-progress-range-a-start) var(--scrollbar-progress-range-a-end);
                --scrollbar-progress-range-a-start: var(--scrollbar-progress-range-start);
                --scrollbar-progress-range-a-end: calc(var(--scrollbar-progress-range-start) + (var(--scrollbar-progress-range-end) - var(--scrollbar-progress-range-start)) / 2);

                --scrollbar-progress-range-b: var(--scrollbar-progress-range-b-start) var(--scrollbar-progress-range-b-end);
                --scrollbar-progress-range-b-start: calc(var(--scrollbar-progress-range-start) + (var(--scrollbar-progress-range-end) - var(--scrollbar-progress-range-start)) / 2);
                --scrollbar-progress-range-b-end: var(--scrollbar-progress-range-end);
            }

            :host(:not(._horz)) {
                --scrollbar-progress-range-start: calc(var(--total-minmax-length) + var(--header-box-height));
            }

            :host(._top:not(._horz)) {
                --scrollbar-appear-range-start: -25px;
                --scrollbar-appear-range-end: 0%;

                --scrollbar-progress-range-start: var(--header-box-height);
                --scrollbar-progress-range-end: calc(100% - var(--total-minmax-length));
            }

            :host(._left._horz) {
                --scrollbar-appear-range-start: -25px;
                --scrollbar-appear-range-end: 0%;

                --scrollbar-progress-range-start: 0%;
                --scrollbar-progress-range-end: calc(100% - var(--total-minmax-length));
            }

            :host(._scrollbars) {
                --effective-scrollbar-appear-opacity: calc(1 * var(--wq-internal-var-scrollbar-appear-progress));

                .scrollbar-track {
                    opacity: calc(var(--effective-scrollbar-appear-opacity) * var(--scrollability));
                }
            }

            :host(._scrollbars:not(._horz)) {
                --effective-scrollbar-progress: calc((var(--view-inner-height) - 100%) * var(--wq-internal-var-scrollbar-progress));

                .scrollbar-thumb {
                    transform: translateY(var(--effective-scrollbar-progress));
                }
            }

            :host(._scrollbars._horz) {
                --effective-scrollbar-progress: calc((var(--view-width) - 100%) * var(--wq-internal-var-scrollbar-progress));

                .scrollbar-thumb {
                    transform: translateX(var(--effective-scrollbar-progress));
                }
            }

            :host(._scroll-unfold) {
                --effective-scroll-unfold-a-opacity: calc(1 * var(--wq-internal-var-scrollbar-progress-b));
                --effective-scroll-unfold-b-opacity: calc(1 * (1 - var(--wq-internal-var-scrollbar-progress-a)));
            }

            :host(._scroll-unfold:is(._top:not(._horz), ._left._horz)) {
                .scroll-fold-start {
                    opacity: var(--effective-scroll-unfold-a-opacity);
                }

                .scroll-fold-end {
                    opacity: calc(var(--effective-scroll-unfold-b-opacity) * var(--scrollability));
                }
            }

            :host(._scroll-unfold:not(._top:not(._horz), ._left._horz)) {
                .scroll-fold-start {
                    opacity: calc(var(--effective-scroll-unfold-a-opacity) * var(--scrollability));
                }

                .scroll-fold-end {
                    opacity: var(--effective-scroll-unfold-b-opacity);
                }
            }

            /*
             * End: scroll-driven animations
             * Start: actual styling
            */

            /* ----------- anchoring, direction, ordering ----------- */

            /* anchoring */

            :host(._top) { margin-top: 0; }
            :host(._bottom) { margin-bottom: 0; }
            :host(._left) { margin-left: 0; }
            :host(._right) { margin-right: 0; }

            /* direction */

            :host,
            .view {
                flex-direction: column;
                align-items: stretch;
            }

            :host(._horz),
            :host(._horz) .view {
                flex-direction: row;
            }

            /* ordering */

            header { order: 1; }
            .scrollport-anchor { order: 2; justify-content: start; }
            .main { order: 3; }
            footer { order: 5; }

            :host(:is(._top:not(._horz), ._left._horz)) {
                .view,
                .container {
                    order: -1;
                }

                .sentinel {
                    order: 1000;
                }

                .scrollport-anchor {
                    order: 4;
                    justify-content: end;
                }
            }

            /* ----------- spacing ----------- */

            :host>.spacing,
            .view>.spacing,
            .view>.sentinel {
                position: relative;
                display: block;
                flex-shrink: 0;
            }

            :host(:not(._horz))>.spacing { height: var(--expanse-length); }
            :host(:not(._horz, ._top, ._bottom))>:is(.spacing, .spacing-b) {
                height: calc(var(--expanse-length) / 2);
                flex-shrink: 0;
            }

            :host(._horz)>.spacing { width: var(--expanse-length); }
            :host(._horz:not(._left, ._right))>:is(.spacing, .spacing-b) {
                width: calc(var(--expanse-length) / 2);
                flex-shrink: 0;
            }

            :host(:not(._horz)) .view>.spacing { height: var(--minmax-length); }
            :host(._horz) .view>.spacing { width: var(--minmax-length); }

            :host(:not(._horz)) .view>.sentinel { height: var(--swipe-dismiss-length); }
            :host(._horz) .view>.sentinel { width: var(--swipe-dismiss-length); }
            
            /* ----------- scroll-snapping ----------- */

            :host(:not(._top:not(._horz), ._left._horz)) .view {
                --scroll-snap-start: start;
                --scroll-snap-end: end;
            }

            :host(:is(._top:not(._horz), ._left._horz)) .view {
                --scroll-snap-start: end;
                --scroll-snap-end: start;
            }

            :host(:not(._horz)) .view {
                scroll-snap-type: y mandatory;
            }

            :host(._horz) .view {
                scroll-snap-type: x mandatory;
            }

            .view>.spacing,
            .view>.sentinel {
                scroll-snap-align: var(--scroll-snap-start);
            }

            .main {
                scroll-margin-top: var(--header-min-height);
                scroll-margin-bottom: var(--footer-min-height);
                scroll-snap-align: var(--scroll-snap-start);
            }

            :host(:is(._top, ._left._horz)) .main {
                scroll-snap-align: none;
            }

            :host(:is(._top, ._left._horz)) .container {
                scroll-snap-align: var(--scroll-snap-start);
            }

            header {
                scroll-snap-align: start;
            }

            .header-bar {
                scroll-snap-align: start;
            }

            /* ----------- elements ----------- */

            :host {
                background: none;
                border: none;
                padding: 0;

                max-height: 100vh;
                max-width: 100vw;
            }
            
            :host(:not(._horz, ._left, ._right, ._top, ._bottom)) {
                max-width: 800px;
            }

            /* view */
            
            .view {
                position: relative;
                flex-grow: 1;
                display: flex;

                pointer-events: none;

                scroll-timeline-name: --view-scroll;
                
                overflow-y: auto;
                scrollbar-width: none;
            }

            :host(._horz) .view {
                overflow-y: hidden;
                overflow-x: auto;

                scroll-timeline-axis: inline;
            }

            .view::-webkit-scrollbar { display: none; }

            /* container */

            .container {
                position: relative;
                flex-grow: 1;

                pointer-events: auto;

                display: flex;
                flex-direction: column;
            }

            /* main */

            .main {
                flex-grow: 1;

                min-width: var(--view-width);
                min-height: var(--view-inner-height);
            }

            /* header */

            header {
                position: sticky;
                top: calc(var(--header-box-height) * -1);

                display: flex;
                flex-direction: column;

                color: var(--header-color-default);
                background: var(--header-background);

                z-index: 2;
            }

            .header-box {
                position: relative;

                display: flex;
                align-items: center;
                justify-content: center;
            }

            :host(._horz) .header-box {
                display: none;
            }

            .header-bar {
                position: relative;

                display: flex;
                align-items: start;
                justify-content: space-between;
                gap: 0.6rem;

                padding-block: 0.8rem;
                padding-inline: 1.2rem;

                z-index: 1;
            }

            .header-left {
                display: flex;
                align-items: start;
                gap: 0.6rem;
            }

            :host(._horz) .header-left,
            header:not(:has(slot[name="header-box"]:is(.has-slotted, :not(:empty)))) .header-left {
                opacity: 1 !important;
            }

            /* footer */

            footer {
                position: sticky;
                bottom: 0;

                color: var(--footer-color-default);
                background: var(--footer-background);

                z-index: 3;
            }
                
            footer .footer-bar {
                position: sticky;
                left: 0;
                right: 0;
            }
            
            /* scrollport */

            .scrollport-anchor {
                position: sticky;
                top: var(--header-min-height);
                bottom: var(--footer-min-height);
                left: 0;
                right: 0;
                display: flex;
                flex-direction: column;

                height: 0;
                width: var(--view-width);

                z-index: 1;
            }

            .scrollport {
                position: relative;

                height: var(--view-inner-height);
                width: var(--view-width);
                flex-shrink: 0;

                pointer-events: none;
            }

            :host(._top:not(._horz)) .scrollport {
                height: calc(var(--view-inner-height) - var(--header-box-height));
            }

            /* -- scrollbars -- */

            .scrollbar-track {
                display: none;
            }

            :host(._scrollbars) .scrollbar-track {
                position: absolute;
                display: block;
                overflow: hidden;

                height: 100%;
                top: 0;
                right: 0;
                padding-inline: 2px;
            }

            :host(._scrollbars._horz) .scrollbar-track {
                height: unset;
                width: 100%;
                top: auto;
                bottom: 0;
                padding-inline: 0;
                padding-block: 2px;
            }

            :host(._scrollbars) .scrollbar-thumb {
                width: var(--scrollbar-thumb-width);
                height: var(--scrollbar-thumb-height);
                background: var(--scrollbar-thumb-color);
                border-radius: 10px;
            }

            :host(._scrollbars._horz) .scrollbar-thumb {
                height: var(--scrollbar-thumb-width);
                width: var(--scrollbar-thumb-height);
            }

            /* scroll unfold */

            :host(._scroll-unfold) .scrollport {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
            }

            :host(._scroll-unfold._horz) .scrollport {
                flex-direction: row;
            }
            
            :host(._scroll-unfold) .scroll-fold {
                position: sticky;
            }

            :host(._scroll-unfold:not(._horz)) {
                .scroll-fold {
                    height: 25%;
                }

                .scroll-fold-start {
                    top: var(--header-min-height);
                    background: linear-gradient(to bottom, var(--background) 0%, transparent 100%);
                }

                .scroll-fold-end {
                    bottom: var(--footer-min-height);
                    background: linear-gradient(to top, var(--background) 0%, transparent 100%);
                }
            }

            :host(._scroll-unfold._horz) {
                .scroll-fold {
                    width: 25%;
                }

                .scroll-fold-start {
                    left: 0;
                    background: linear-gradient(to right, var(--background) 0%, transparent 100%);
                }

                .scroll-fold-end {
                    right: 0;
                    background: linear-gradient(to left, var(--background) 0%, transparent 100%);
                }
            }

            /* ----------- theming ----------- */

            /* aero-blur */

            :host(._aero) :is(header, .main, footer) {
                backdrop-filter: blur(var(--aero-blur));
            }

            /* coloring */

            :host([type="info"]) .container {
                color: var(--color-info);
            }
            
            :host([type="success"]) .container {
                color: var(--color-success);
            }

            :host([type="error"]) .container {
                color: var(--color-error);
            }

            :host([type="warning"]) .container {
                color: var(--color-warning);
            }

            .main {
                color: var(--color-default);
                background: var(--background);
            }

            :host([type="info"]) header {
                color: var(--header-color-info);
            }
            
            :host([type="success"]) header {
                color: var(--header-color-success);
            }

            :host([type="error"]) header {
                color: var(--header-color-error);
            }
            
            :host([type="info"]) footer {
                color: var(--footer-color-info);
            }
            
            :host([type="success"]) footer {
                color: var(--footer-color-success);
            }

            :host([type="error"]) footer {
                color: var(--footer-color-error);
            }

            /* ----------- icons ----------- */

            .icon {
                display: none;
                opacity: 0.6;
            }

            :host([type="info"]) .icon._info,
            :host([type="success"]) .icon._success,
            :host([type="error"]) .icon._error,
            :host([type="warning"]) .icon._warning {
                display: block;
            }
            
            /* ----------- controls ----------- */

            .close-button {
                padding-inline: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                appearance: none;
                font-size: inherit;
                color: var(--close-button-color);
                cursor: pointer;
                border: none;
                background: none;
            }

            :host(:not([popover="manual"], ._manual-dismiss)) .close-button {
                display: none;
            }

            .close-button:hover {
                opacity: 0.8;
            }

            :host(._horz) :is(.header-left, .close-button) {
                position: sticky;
                left: 1.2rem;
                right: 1.2rem;
            }
            
            ${this.css}
        </style>
        `;

        this.#viewElement = this.shadowRoot.querySelector('.view');
        this.#sentinelElement = this.#viewElement.querySelector('.sentinel');
        this.#spacingElement = this.#viewElement.querySelector('.spacing');
        this.#headerElement = this.#viewElement.querySelector('header');
        this.#headerBoxElement = this.#viewElement.querySelector('.header-box');
        this.#footerElement = this.#viewElement.querySelector('footer');
    }
}

// ---------------- DialogElement

export class DialogResponseEvent extends Event {

    #data;
    get data() { return this.#data; }

    constructor(data) {
        super('response');
        this.#data = data;
    }
}

export class DialogElement extends ModalElement {

    static get events() {
        return super.events.concat(['response']);
    }

    get delegatesFocus() { return true; }

    // ----------------

    hidePopover() { this.respondWith(null); }

    respondWith(response) {
        const event = new DialogResponseEvent(response);
        super.hidePopover();
        this.dispatchEvent(event);
    }

    respondWithData() {
        const data = this.querySelector('form')
            || this.shadowRoot.querySelector('form');
        this.respondWith(data);
    }

    render(data = {}) {
        this.type = data.type;

        const html = [data.message];
        if (data.actions?.[0]) {
            html.push(`<span slot="action-0">${data.actions[0]}</span>`);
        }
        if (data.actions?.[1]) {
            html.push(`<span slot="action-1">${data.actions[1]}</span>`);
        }

        this.innerHTML = html.join('\n');
    }

    get actionTexts() { return ['Cancel', 'Submit']; }

    get footerHTML() {
        return `                    
            <button
                part="action-0"
                class="action _secondary"
                onclick="this.getRootNode().host.hidePopover()">
                <svg xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M256-176 176-256l224-224-224-224 80-80 224 224 224-224 80 80-224 224 224 224-80 80-224-224-224 224Z"/></svg>
                <slot name="action-0" onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length);">${this.actionTexts[0]}</slot>
            </button>

            <button
                part="action-1"
                class="action _primary"
                onclick="this.getRootNode().host.respondWithData()">
                <svg xmlns="http://www.w3.org/2000/svg" height="1.4em" width="1.4em" viewBox="0 -960 960 960" fill="currentColor"><path d="M369-222 128-463l84-84 157 157 379-379 84 84-463 463Z"/></svg>
                <slot name="action-1" onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length);">${this.actionTexts[1]}</slot>
            </button>
        `;
    }

    get css() {
        return super.css + `
            :host {
                --primary-button-color: var(--dialog-primary-button-color, black);
                --primary-button-background: var(--dialog-primary-button-background, white);
                --secondary-button-color: var(--dialog-secondary-button-color, white);
                --secondary-button-background: var(--dialog-secondary-button-background, black);
                --button-radius: var(--dialog-button-radius, 10px);
            }

            .main {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                gap: 1rem;
                padding: 1rem;
            }

            .footer-bar {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem;
            }

            button.action {
                whitespace: nowrap;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                border: none;
                border-radius: var(--button-radius);
                padding: 0.5rem 1rem;
                cursor: pointer;
                transition: all 0.2s;
                font-size: inherit;
                font-weight: bold;
                flex-grow: 1;
            }

            button.action:hover {
                opacity: 0.8;
            }
            
            button.action:is(:focus, :active, .active) {
                outline: none;
                box-shadow: none;
                opacity: 0.5;
            }

            button.action._primary {
                background-color: var(--primary-button-background);
                color: var(--primary-button-color);
            }

            button.action._secondary {
                background-color: var(--secondary-button-background);
                color: var(--secondary-button-color);
            }

            button.action:not(:has(slot:is(.has-slotted, :not(:empty)))) {
                display: none;
            }
        `;
    }
}

// ---------------- PromptElement

export class PromptElement extends DialogElement {

    static get observedAttributes() {
        return super.observedAttributes.concat(['value', 'placeholder']);
    }

    // ----------------

    attributeChangedCallback(name, old, _new) {
        super.attributeChangedCallback?.(name, old, _new);

        const input = this.shadowRoot.querySelector('input');
        if (name === 'value') input.value = _new;
        if (name === 'placeholder') input.placeholder = _new;
    }

    set placeholder(value) {
        if ([undefined, null].includes(value)) {
            this.removeAttribute('placeholder');
        } else this.setAttribute('placeholder', value);
    }

    get placeholder() { return this.getAttribute('placeholder'); }

    set value(value) {
        if ([undefined, null].includes(value)) {
            this.removeAttribute('value');
        } else this.setAttribute('value', value);
    }

    get value() { return this.getAttribute('value'); }

    respondWithData() {
        const data = this.shadowRoot.querySelector('input').value;
        this.respondWith(data);
    }

    render(data = {}) {
        this.value = data.value;
        this.placeholder = data.placeholder;
        super.render(data);
    }

    get mainHTML() {
        return `
            <form class="main" part="main" onsubmit="this.getRootNode().host.respondWithData(); event.preventDefault();">
                <slot></slot>
                <slot name="input">
                    <input part="input" type="text" autocomplete="off" autofocus placeholder="Enter response">
                </slot>
            </form>
        `;
    }

    get actionTexts() { return ['Cancel', 'Submit']; }

    get css() {
        return super.css + `
            :host {
                --input-color: var(--prompt-input-color, inherit);
                --input-background: var(--prompt-input-background, rgba(255, 255, 255, 0.2));
                --input-radius: var(--prompt-input-radius, 10px);
            }

            input {
                width: 100%;
                border: none;
                border-radius: var(--input-radius);
                padding: 0.6rem 1rem;
                color: var(--input-color);
                background-color: var(--input-background);
            }

            input::placeholder {
                color: currentColor;
            }
        `;
    }
}

// ---------------- ConfirmElement

export class ConfirmElement extends DialogElement {
    get actionTexts() { return ['No', 'Yes']; }

    respondWith(response) { super.respondWith(!!response); }

    respondWithData() { super.respondWith(true); }
}

// ---------------- AlertElement

export class AlertElement extends DialogElement {
    get actionTexts() { return ['', 'Got it']; }
}

// ---------------- define

export function defineElements() {
    // radius

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-radius-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    // header-box

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-header-box-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-header-box-progress-a',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-header-box-progress-b',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    // minmax

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-minmax-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-minmax-progress-a',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-minmax-progress-b',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    // minmax-balance

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-total-minmax-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    // swipe-dismiss

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-swipe-dismiss-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    // Scrollbars

    try {
        CSS.registerProperty({
            name: '--wq-internal-var-scrollbar-appear-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-scrollbar-progress',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-scrollbar-progress-a',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }
    try {
        CSS.registerProperty({
            name: '--wq-internal-var-scrollbar-progress-b',
            syntax: '<number>',
            inherits: true,
            initialValue: '0'
        });
    } catch (e) { }

    customElements.define('wq-toast', ToastElement);
    customElements.define('wq-modal', ModalElement);
    customElements.define('wq-dialog', DialogElement);
    customElements.define('wq-prompt', PromptElement);
    customElements.define('wq-confirm', ConfirmElement);
    customElements.define('wq-alert', AlertElement);
}