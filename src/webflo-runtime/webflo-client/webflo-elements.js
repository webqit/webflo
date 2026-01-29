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

                --wq-radius: var(--toast-radius, 1rem);
                --background: var(--toast-background, rgb(30, 30, 30));
                --shadow: var(--toast-shadow, rgb(30, 30, 30));

                --dir: 1;
                --translation: calc(var(--toast-translation, 50px) * var(--dir));
                --exit-factor: var(--toast-exit-factor, -1);

                --entry-transform: translateY(var(--translation));
                --exit-transform: translateY(calc(var(--translation) * var(--exit-factor)));
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
                --dir: -1;
            }

            /* ----------- */

            .container {
                position: relative;

                display: flex;
                align-items: start;
                gap: 0.6rem;

                padding-block: 0.8rem;
                padding-inline: 1.2rem;
                border-radius: var(--wq-radius);

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

    updateScrollViewDimensions() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                let viewWidth, viewHeight;

                const swipeDismiss = this.classList.contains('_swipe-dismiss');
                const minmaxScroll = !!window.getComputedStyle(this).getPropertyValue('--modal-minmax-length');

                if (swipeDismiss || minmaxScroll) {
                    requestAnimationFrame(() => {
                        let left = 0, top = 0;
                        if (this.matches('._left._horz, ._top:not(._horz)')) {
                            this.#viewElement.scrollTo({ top, left });
                        } else {
                            if (this.classList.contains('_horz')) {
                                viewWidth = this.#viewElement.offsetWidth;
                                left = viewWidth - this.#spacingElement.offsetWidth;
                            } else {
                                viewHeight = this.#viewElement.offsetHeight;
                                top = viewHeight - this.#spacingElement.offsetHeight;
                            }
                            if (this.#viewElement.scrollTop < top || this.#viewElement.scrollLeft < left) {
                                this.#viewElement.scrollTo({ top, left });
                            }
                        }
                    });
                }

                this.#viewElement.style.setProperty('--header-box-height', this.#headerBoxElement.offsetHeight + 'px');
                this.#viewElement.style.setProperty('--header-max-height', this.#headerElement.offsetHeight + 'px');
                this.#viewElement.style.setProperty('--footer-max-height', this.#footerElement.offsetHeight + 'px');

                if (this.classList.contains('_container')) return;
                if (viewWidth === undefined) viewWidth = this.#viewElement.offsetWidth;
                if (viewHeight === undefined) viewHeight = this.#viewElement.offsetHeight;

                this.#viewElement.style.setProperty('--view-width', viewWidth + 'px');
                this.#viewElement.style.setProperty('--view-height', viewHeight + 'px');
            });
        });
    }

    #unbindMinmaxWorker = null;

    bindMinmaxWorker() {
        const swipeDismiss = this.classList.contains('_swipe-dismiss');
        const minmaxEvents = this.classList.contains('_minmax-events');

        if (!swipeDismiss && !minmaxEvents) return;

        const options = {
            root: this.#viewElement,
            threshold: [0, 1]
        };

        const observer = new IntersectionObserver((entries) => {
            if (!this.#userScrolled) return;

            for (const entry of entries) {
                // Minmax events
                if (entry.target === this.#spacingElement) {
                    const event = new ModalMinmaxEvent(1 - entry.intersectionRatio);
                    this.dispatchEvent(event);
                }

                // For auto-closing
                if (entry.target === this.#sentinelElement
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


        this.updateScrollViewDimensions();
        const handleResize = () => this.updateScrollViewDimensions();
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

        if (name === 'class') this.#bindDimensionsWorker();
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
                this.#bindDimensionsWorker();
                this.bindMinmaxWorker();

                if (!this.delegatesFocus
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
                            onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length); this.closest('.view').style.setProperty('--header-box-height', this.closest('.header-box').offsetHeight + 'px');"
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
                                    onslotchange="this.closest('.view').style.setProperty('--header-max-height', this.closest('header').offsetHeight + 'px');"
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
                            onslotchange="this.closest('.view').style.setProperty('--header-max-height', this.closest('header').offsetHeight + 'px');"
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

                ${this.mainHTML || `<div class="main" part="main">${this.contentHTML || `<slot></slot>`
            }</div>`}

                <footer part="footer">
                    <div class="footer-bar" part="footer-bar">
                        <slot
                            name="footer"
                            onslotchange="this.classList.toggle('has-slotted', !!this.assignedElements().length); this.closest('.view').style.setProperty('--footer-max-height', this.closest('footer').offsetHeight + 'px');"
                        >${this.footerHTML}</slot>
                    </div>
                </footer>

            </div>
        </div>
        <span class="spacing-b"></span>

        <style>
            * {
                box-sizing: border-box;
            }

            @keyframes untransform {
                to { transform: none; }
            }

            @keyframes transform-n {
                to { transform: var(--transform); }
            }

            @keyframes appear {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes disappear {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            @keyframes header-chrome {
                from { background: var(--header-open-background); }
                to { background: var(--header-background); }
            }

            @keyframes move-scrollbar-thumb {
                from { transform: var(--scrollbar-thumb-start); }
                to { transform: var(--scrollbar-thumb-length); }
            }

            @keyframes radius0 {
                to { --wq-radius: 0; }
            }

            :host {
                --wq-radius: var(--modal-radius, 1rem);
                --aero-blur: var(--modal-aero-blur, 10px);
                --background: var(--modal-background, rgba(80, 80, 80, 1));

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

                --expanse-length: var(--modal-expanse-length, 0px);
                --minmax-length: var(--modal-minmax-length, 0px);

                --scrollbar-thumb-color: var(--modal-scrollbar-thumb-color, black);
                --scrollbar-thumb-width: var(--modal-scrollbar-thumb-width, 4px);
                --scrollbar-thumb-height: var(--modal-scrollbar-thumb-height, 30px);

                --translation: calc(var(--modal-translation, 50px) * var(--dir));
                --exit-factor: var(--modal-exit-factor, -1);
            }

            /* -------- internal, dynamic props (root) -------- */

            :host {
                --dir: 1;
                --entry-transform: translateY(var(--translation));
                --exit-transform: translateY(calc(var(--translation) * var(--exit-factor)));
            }

            :host(._swipe-dismiss) .view {
                --swipe-dismiss-length: var(--modal-swipe-dismiss-length, calc(var(--view-height) - var(--minmax-length)));
            }

            :host(._horz._swipe-dismiss) .view {
                --swipe-dismiss-length: var(--modal-swipe-dismiss-length, calc(var(--view-width) - var(--minmax-length)));
            }
            
            /* transform reversal */

            :host(:is(._top, ._left)) { --dir: -1; }

            /* horizontal axis */

            :host(:is(._left, ._right, ._horz)) {                
                --entry-transform: translateX(var(--translation));
                --exit-transform: translateX(calc(var(--translation) * var(--exit-factor)));
            }

            :host(._edge-tight) { --exit-factor: var(--modal-exit-factor, 1); }

            /* -------- internal, dynamic props (view) -------- */

            .view {
                --header-max-height: 1.6rem;
                --header-box-height: 0px;
                --footer-max-height: 0px;

                --header-min-height: calc(var(--header-max-height) - var(--header-box-height));
                --footer-min-height: var(--footer-max-height);

                --view-inner-height: calc(var(--view-height) - var(--header-min-height) - var(--footer-min-height));
                --total-minmax-length: var(--minmax-length);
                
                --y-scroll-effect-exclude: var(--total-minmax-length);
                --scrollbar-appear-range: calc(var(--total-minmax-length) - 25px) var(--total-minmax-length);
                
                --scrollbar-progress-range-start: calc(var(--total-minmax-length) + var(--header-box-height));
                --scrollbar-progress-range-end: 100%;
                --scrollbar-progress-range: var(--scrollbar-progress-range-start) var(--scrollbar-progress-range-end);

                --scroll-snap-start: start;
                --scroll-snap-end: end;

                --radius-top-left: var(--wq-radius);
                --radius-top-right: var(--wq-radius);
                --radius-bottom-left: var(--wq-radius);
                --radius-bottom-right: var(--wq-radius);
            }

            :host(._container) .view {
                --view-height: calc(100cqh - var(--expanse-length));
                --view-width: 100cqw;
            }

            :host(._container._horz) .view {
                --view-height: 100cqh;
                --view-width: calc(100cqw - var(--expanse-length));
            }

            :host(._swipe-dismiss:not(._horz)) .view {
                --total-minmax-length: var(--view-height);
            }

            :host(._swipe-dismiss._horz) .view {
                --total-minmax-length: var(--view-width);
            }

            /* transform reversal */

            :host(:is(._top:not(._horz), ._left._horz)) .view {
                --scroll-snap-start: end;
                --scroll-snap-end: start;

                --y-scroll-effect-exclude: 0px;
                --scrollbar-appear-range: -25px 0;
            }

            :host(._top:not(._horz)) .view {
                --scrollbar-progress-range-start: var(--header-box-height);
                --scrollbar-progress-range-end: calc(100% - var(--total-minmax-length));
            }

            :host(._left._horz) .view {
                --scrollbar-progress-range-start: 0;
                --scrollbar-progress-range-end: calc(100% - var(--total-minmax-length));
            }

            /* curves */

            :host(._top._edge-tight) .view {
                --radius-top-left: 0px;
                --radius-top-right: 0px;
            }

            :host(._bottom._edge-tight) .view {
                --radius-bottom-left: 0px;
                --radius-bottom-right: 0px;
            }

            :host(._left._edge-tight) .view {
                --radius-top-left: 0px;
                --radius-bottom-left: 0px;
            }

            :host(._right._edge-tight) .view {
                --radius-top-right: 0px;
                --radius-bottom-right: 0px;
            }

            /* --------- actual styling -------- */

            :host {
                background: none;
                border: none;
                padding: 0;

                max-height: 100vh;
                max-width: 100vw;
                
                /* Transition */
                transition:
                    opacity 0.2s,
                    transform 0.2s,
                    overlay 0.2s allow-discrete,
                    display 0.2s allow-discrete;
                transition-timing-function: ease-out;
                
                /* Exit state */
                transform: var(--exit-transform);
                opacity: 0;
            }
            
            :host(:not(._horz, ._left, ._right, ._top, ._bottom)) {
                max-width: 800px;
            }

            /* edge alignment */

            :host(._top) { margin-top: 0; }
            :host(._bottom) { margin-bottom: 0; }
            :host(._left) { margin-left: 0; }
            :host(._right) { margin-right: 0; }

            /* flex orientation */

            :host,
            .view {
                flex-direction: column;
                align-items: stretch;
            }

            :host(._horz),
            :host(._horz) .view {
                flex-direction: row;
            }

            :host(:is(._top:not(._horz), ._left._horz)) .view,
            :host(:is(._top:not(._horz), ._left._horz)) .view .container {
                order: -1;
            }

            :host(:is(._top:not(._horz), ._left._horz)) .view .sentinel {
                order: 1000;
            }

            /* spacing */

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

            /* ----------- */

            .view {
                position: relative;
                flex-grow: 1;
                display: flex;

                pointer-events: none;

                overflow-y: auto;
                scrollbar-width: none;

                border-top-left-radius: var(--radius-top-left);
                border-top-right-radius: var(--radius-top-right);
                border-bottom-left-radius: var(--radius-bottom-left);
                border-bottom-right-radius: var(--radius-bottom-right);

                scroll-timeline-name: --view-scroll;

                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: untransform;
                animation-timeline: --view-scroll;

                animation-range: 0 var(--total-minmax-length);
            }

            :host(:not(._horz, ._top, ._bottom, ._edge-tight._alt-edge-tight)) .view {
                transform: translateY(calc(var(--total-minmax-length) / -2));
            }

            :host(._horz:not(._left, ._right, ._edge-tight._alt-edge-tight)) .view {
                transform: translateX(calc(var(--total-minmax-length) / -2));
            }

            :host(._edge-tight._alt-edge-tight) .view {
                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: radius0;
                animation-timeline: --view-scroll;

                animation-range: calc(var(--total-minmax-length) - var(--wq-radius)) var(--total-minmax-length);
            }

            :host(._horz) .view {
                overflow-y: hidden;
                overflow-x: auto;

                scroll-timeline-axis: inline;
            }

            .view::-webkit-scrollbar { display: none; }

            /* ----------- */

            .container {
                position: relative;
                flex-grow: 1;

                pointer-events: auto;

                display: flex;
                flex-direction: column;
            }

            :host(._swipe-dismiss-fadeout) .container {
                animation-timing-function: linear;
                animation-fill-mode: both;
                animation-name: appear;
                animation-timeline: --view-scroll;
                animation-range: 0 var(--swipe-dismiss-length);
            }

            :host(._swipe-dismiss-fadeout:is(._top:not(._horz), ._left._horz)) .container {
                animation-name: disappear;
                animation-range: calc(100% - var(--swipe-dismiss-length)) 100%;
            }

            /* ------------ */
            
            header {
                position: sticky;
                top: calc(var(--header-box-height) * -1);
                z-index: 2;

                display: flex;
                flex-direction: column;

                color: var(--header-color-default);
                background: var(--header-background);

                border-top-left-radius: var(--radius-top-left);
                border-top-right-radius: var(--radius-top-right);

                order: 1;
            }

            :host(:not(._horz)) header {
                animation-timing-function: linear;
                animation-fill-mode: both;
                animation-name: header-chrome;
                animation-timeline: --view-scroll;
                animation-range: var(--y-scroll-effect-exclude) calc(var(--y-scroll-effect-exclude) + var(--header-box-height));
            }

            :host(._aero) :is(header, .main, footer) {
                backdrop-filter: blur(var(--aero-blur));
            } 

            .header-box {
                position: relative;

                display: flex;
                align-items: center;
                justify-content: center;

                --transform: translateY(35%);

                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: disappear, transform-n;
                animation-timeline: --view-scroll;
                animation-range: var(--y-scroll-effect-exclude) calc(var(--y-scroll-effect-exclude) + (var(--header-box-height) / 2));
            }

            :host(._horz) .header-box {
                display: none;
            }

            .header-bar {
                position: relative;
                z-index: 1;

                display: flex;
                align-items: start;
                justify-content: space-between;
            }

            .header-bar {
                gap: 0.6rem;
                padding-block: 0.8rem;
                padding-inline: 1.2rem;
            }

            .header-left {
                display: flex;
                align-items: start;
                gap: 0.6rem;

                opacity: 0;

                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: appear;
                animation-timeline: --view-scroll;
                animation-range: calc(var(--y-scroll-effect-exclude) + (var(--header-box-height) / 2)) calc(var(--y-scroll-effect-exclude) + var(--header-box-height));
            }

            :host(._horz) .header-left,
            header:not(:has(slot[name="header-box"]:is(.has-slotted, :not(:empty)))) .header-left {
                opacity: 1;
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
            
            /* ----------- */

            footer {
                position: sticky;
                bottom: 0;
                z-index: 1;

                border-bottom-left-radius: var(--radius-bottom-left);
                border-bottom-right-radius: var(--radius-bottom-right);

                color: var(--footer-color-default);
                background: var(--footer-background);

                order: 5;
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

            /* ------------ */

            footer .footer-bar {
                position: sticky;
                left: 0;
                right: 0;
            }

            /* ----------- */

            .view {
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
                flex-grow: 1;

                min-width: var(--view-width);
                min-height: var(--view-inner-height);

                scroll-margin-top: var(--header-min-height);
                scroll-margin-bottom: var(--footer-min-height);
                scroll-snap-align: var(--scroll-snap-start);

                order: 3;
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

            /* ----------- */

            .scrollport-anchor {
                order: 2;

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

            :host(:is(._left._horz, ._top:not(._horz))) .scrollport-anchor {
                justify-content: end;
                order: 4;
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

            /* -- scroll unfold -- */

            :host(._scroll-unfold) .scrollport {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: stretch;
            }

            :host(._scroll-unfold._horz) .scrollport {
                flex-direction: row;
            }
            
            :host(._scroll-unfold) .scrollport .scroll-fold {
                position: sticky;
                opacity: 0;

                background: var(--background);

                mask-repeat: no-repeat;
                mask-size: 100% 100%;

                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: appear;
                animation-timeline: --view-scroll;

                animation-range-start: var(--scrollbar-progress-range-start);
                animation-range-end: calc(var(--scrollbar-progress-range-end) + 1px);
            }

            :host(._scroll-unfold) .scrollport .scroll-fold-end {
                animation-range-start: calc(var(--scrollbar-progress-range-start) - 1px);
                animation-range-end: var(--scrollbar-progress-range-end);
            }

            :host(._scroll-unfold:not(._horz)) .scrollport .scroll-fold {
                top: var(--header-min-height);
                height: 25%;

                mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
                -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
            }

            :host(._scroll-unfold:not(._horz)) .scrollport .scroll-fold-end {
                bottom: var(--footer-min-height);
                top: auto;
                opacity: 1;
                animation-name: disappear;
                transform: scaleY(-1);
            }

            :host(._scroll-unfold._horz) .scrollport .scroll-fold {
                left: 0;
                width: 25%;

                mask-image: linear-gradient(to right, black 0%, transparent 100%);
                -webkit-mask-image: linear-gradient(to right, black 0%, transparent 100%);
            }

            :host(._scroll-unfold._horz) .scrollport .scroll-fold-end {
                right: 0;
                left: auto;
                opacity: 1;
                animation-name: disappear;
                transform: scaleX(-1);
            }

            /* -- scrollbar -- */

            :host(._scrollbars) .scrollbar-track {
                position: absolute;
                display: block;
                overflow: hidden;

                height: 100%;
                top: 0;
                right: 0;
                padding-inline: 2px;

                opacity: 0;

                animation: appear linear;
                animation-timeline: --view-scroll;
                animation-range: var(--scrollbar-appear-range);
                animation-fill-mode: forwards;
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

                --scrollbar-thumb-start: translateY(0);
                --scrollbar-thumb-length: translateY(calc(var(--view-inner-height) - 100%));

                animation: move-scrollbar-thumb linear both;
                animation-timeline: --view-scroll;
                animation-range: var(--scrollbar-progress-range);
            }

            :host(._scrollbars._horz) .scrollbar-thumb {
                height: var(--scrollbar-thumb-width);
                width: var(--scrollbar-thumb-height);

                --scrollbar-thumb-start: translateX(0);
                --scrollbar-thumb-length: translateX(calc(var(--view-width) - 100%));
            }

            /* ----------- */

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
                /* Transition */
                transition:
                    display 0.2s allow-discrete,
                    overlay 0.2s allow-discrete,
                    backdrop-filter 0.2s;
            }

            :host(._swipe-dismiss._container) {
                timeline-scope: --view-scroll;
            }

            :host(._swipe-dismiss._container)::backdrop {
                opacity: 0;

                animation-timing-function: linear;
                animation-fill-mode: forwards;
                animation-name: appear;
                animation-timeline: --view-scroll;

                animation-range: 0 calc(100cqh - var(--expanse-length) - var(--minmax-length));
            }

            :host(._swipe-dismiss._container._horz)::backdrop {
                animation-range: 0 calc(100cqw - var(--expanse-length) - var(--minmax-length));
            }

            :host(._swipe-dismiss._container._top:not(._horz))::backdrop,
            :host(._swipe-dismiss._container._left._horz)::backdrop {
                opacity: 1;
                animation-name: disappear;
            }

            :host(._swipe-dismiss._container._top:not(._horz))::backdrop {
                animation-range: calc(100% - (100cqh - var(--expanse-length) - var(--minmax-length))) 100%;
            }

            :host(._swipe-dismiss._container._left._horz)::backdrop {
                animation-range: calc(100% - (100cqw - var(--expanse-length) - var(--minmax-length))) 100%;
            }

            :host(:popover-open)::backdrop {
                backdrop-filter: blur(3px);
            }

            :host(:not([popover="manual"], ._manual-dismiss):popover-open)::backdrop {
                backdrop-filter: blur(0px);
            }

            @starting-style {
                :host(:popover-open)::backdrop {
                    backdrop-filter: none;
                }
            }
                
            :host(:popover-open)::before {
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

            .main {
                color: var(--color-default);
                background: var(--background);
            }

            .view:not(:has(footer slot:is(.has-slotted, :not(:empty)))) .main {
                border-bottom-left-radius: var(--radius-bottom-left);
                border-bottom-right-radius: var(--radius-bottom-right);
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
    try {
        CSS.registerProperty({
            name: '--wq-radius',
            syntax: '<length-percentage>',
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