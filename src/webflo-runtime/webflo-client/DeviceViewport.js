export class DeviceViewport {

    #stack = [];
    #ownedElements = new Set(); // Stores elements created by this class
    #elements = {};             // Map of active elements/selectors
    #timer = null;              // For commit batching

    #specials = {
        themeColor: { name: 'theme-color', type: 'meta' },
        appleStatusBarStyle: { name: 'apple-mobile-web-app-status-bar-style', type: 'meta' },
        colorScheme: { name: 'color-scheme', type: 'meta' },
        manifest: { name: 'manifest', type: 'link' }
    };

    constructor() {
        const initialState = { _isInitial: true };

        // 1. Ingest Viewport
        const vMeta = document.querySelector('meta[name="viewport"]');
        if (vMeta) {
            this.#elements.viewport = vMeta;
            Object.assign(initialState, this.#parseViewport(vMeta.content));
        }

        // 2. Ingest Title & Specials
        initialState.title = document.title;
        Object.entries(this.#specials).forEach(([jsKey, config]) => {
            const el = this.#findDom(config);
            if (el) {
                this.#elements[jsKey] = el;
                initialState[jsKey] = config.type === 'link' ? el.getAttribute('href') : el.getAttribute('content');
            }
        });

        this.#stack.push(initialState);
    }

    #findDom({ name, type }) {
        return type === 'link'
            ? document.querySelector(`link[rel="${name}"]`)
            : document.querySelector(`meta[name="${name}"]`);
    }

    #getOrCreate(jsKey, media = null) {
        const cacheKey = media ? `${jsKey}-${media}` : jsKey;
        if (this.#elements[cacheKey]) return this.#elements[cacheKey];

        const config = this.#specials[jsKey] || { name: 'viewport', type: 'meta' };
        const el = document.createElement(config.type);

        if (config.type === 'link') el.rel = config.name;
        else el.name = config.name;
        if (media) el.setAttribute('media', media);

        document.head.appendChild(el);
        this.#ownedElements.add(el);
        this.#elements[cacheKey] = el;
        return el;
    }

    #scheduleRender() {
        if (this.#timer) return;
        this.#timer = requestAnimationFrame(() => {
            this.#render();
            this.#timer = null;
        });
    }

    #render() {
        const state = this.peek();
        const viewportDirectives = [];
        const activeKeys = new Set(Object.keys(state).filter(k => k !== 'id' && !k.startsWith('_')));

        // 1. Handle Title
        if ('title' in state) {
            document.title = state.title || '';
            activeKeys.delete('title');
        }

        // 2. Handle Specials (with Media Query Support)
        Object.keys(this.#specials).forEach(jsKey => {
            const val = state[jsKey]; // Can be string or { default, dark, light, "(media)": color }
            activeKeys.delete(jsKey);

            const seen = new Set();

            if (val && typeof val === 'object' && jsKey === 'themeColor') {
                // Media Query Logic
                Object.entries(val).forEach(([query, color]) => {
                    const mediaStr = query === 'dark' ? '(prefers-color-scheme: dark)' :
                        query === 'light' ? '(prefers-color-scheme: light)' :
                            query === 'default' ? '' : query;
                    seen.add(mediaStr);
                    this.#setAttr(jsKey, color, mediaStr);
                });
            } else {
                seen.add('');
                this.#setAttr(jsKey, val);
            }

            // cleanup
            Object.keys(this.#elements)
                .filter(k => k === jsKey || k.startsWith(`${jsKey}-`))
                .forEach(k => {
                    const keyId = k === jsKey ? '' : k.slice(jsKey.length + 1);
                    if (!seen.has(keyId)) {
                        this.#setAttr(jsKey, null, keyId);
                    }
                });
        });

        // 3. Handle Viewport
        activeKeys.forEach(key => {
            const val = state[key];
            if (val === null) return;
            const kebab = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            viewportDirectives.push(val === true ? kebab : `${kebab}=${val}`);
        });

        const vContent = viewportDirectives.join(', ');
        const vEl = this.#elements.viewport || (vContent ? this.#getOrCreate('viewport') : null);
        if (vEl) {
            vEl.setAttribute('content', vContent);
            if (!vContent && this.#ownedElements.has(vEl)) {
                vEl.remove();
                delete this.#elements.viewport;
            }
        }
    }

    #setAttr(jsKey, val, media = null) {
        const cacheKey = media ? `${jsKey}-${media}` : jsKey;
        const config = this.#specials[jsKey];
        const attrName = config.type === 'link' ? 'href' : 'content';

        if (val !== undefined && val !== null) {
            const el = this.#getOrCreate(jsKey, media);
            if (el.getAttribute(attrName) !== val) {
                el.setAttribute(attrName, val);
            }
        } else {
            const el = this.#elements[cacheKey];
            if (el) {
                if (this.#ownedElements.has(el)) {
                    el.remove();
                    delete this.#elements[cacheKey];
                } else if (el.getAttribute(attrName) !== '') {
                    el.setAttribute(attrName, '');
                }
            }
        }
    }

    #parseViewport = (c) => Object.fromEntries(c.split(',').filter(Boolean).map(s => {
        const [k, v] = s.split('=').map(p => p.trim());
        return [k.replace(/-([a-z])/g, g => g[1].toUpperCase()), v || true];
    }));

    push(id, config) {
        if (!id) throw new Error("push() requires a unique ID");
        if (this.#stack.some(e => e.id === id)) return;
        this.#stack.push({ ...this.peek(), ...config, id, _isInitial: false });
        this.#scheduleRender();
    }

    pop(id) {
        if (!id) throw new Error("pop() requires a target ID");
        const idx = this.#stack.findIndex(e => e.id === id);
        if (idx > 0) { // Never pop the initial state at index 0
            this.#stack.splice(idx, 1);
            this.#scheduleRender();
        }
    }

    peek() { return this.#stack[this.#stack.length - 1]; }
}
