export class WebfloHMR {

    static manage(app) {
        return new this(app);
    }

    #app;

    #socket;
    get socket() { return this.#socket; }

    #selectors = {
        remoteStyleSheet: 'link[rel="stylesheet"][href]',
        remoteHtmlModule: 'template[def][src]',
        inlineHtmlModule: 'template[def]:not([src])'
    };

    #removedCSS = new Set;
    #removedHTML = new Map;

    constructor(app) {
        this.#app = app;
        this.#socket = new WebSocket('/?rel=hmr');
        this.#socket.onmessage = async (msg) => {
            const events = JSON.parse(msg.data);
            await this.fire(events);
        };
    }

    async fire(events) {
        const statuses = {
            numCSSAffected: 0,
            numHTMLAffected: 0,
            routesAffected: new Set,
            currentRouteAffected: false,
            serviceWorkerAffected: false,
        };
        for (const { ...event } of events) {
            if (event.affectedRoute) {
                if (event.realm === 'client') {
                    if (event.actionableEffect === 'unlink') {
                        delete this.#app.routes[event.affectedRoute];
                    } else {
                        this.#app.routes[event.affectedRoute] = `/@dev?src=${event.affectedHandler}&t=${Date.now()}`;
                    }
                    statuses.routesAffected.add(event.affectedRoute);
                } else if (event.realm === 'worker') {
                    statuses.serviceWorkerAffected = true;
                }
                // Now both for realm === client | worker | server
                if (this.#app.location.pathname.startsWith(event.affectedRoute)) {
                    statuses.currentRouteAffected = true;
                }
            } else {
                const parts = event.target.split('/');
                const upCount = parts.filter((p) => p === '..').length;
                const remaining = parts.filter((p) => p !== '..' && p !== '.');
                const $target = '/' + remaining.slice(upCount).join('/');
                event.$target = new URL($target, window.location.origin/*not href*/);
                if (event.fileType === 'css') {
                    statuses.numCSSAffected += await this.handleAffectedStyleSheets(event);
                } else if (event.fileType === 'html' || /Dir$/.test(event.type)) {
                    statuses.numHTMLAffected += await this.handleAffectedHTMLModules(event);
                }
            }
        }
        let serviceWorkerUpdateDone;
        if (statuses.serviceWorkerAffected && 'serviceWorker' in navigator) {
            // Must run before any reload below
            serviceWorkerUpdateDone = this.updateServiceWorker().then(async (status) => {
                console.log('[HMR] Service Worker Update:', status);
            });
        }
        if (statuses.currentRouteAffected) {
            Promise.resolve(serviceWorkerUpdateDone).then(async () => {
                await this.#app.navigate(this.#app.location.href);
            });
        }
    }

    async updateServiceWorker() {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return 0;
        registration.update();
        return await new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(1));
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return resolve(0);
            });
        });
    }

    async handleAffectedStyleSheets(event) {
        const sheets = document.querySelectorAll(this.#selectors.remoteStyleSheet);
        let _count = 0;
        for (const node of [...sheets, ...this.#removedCSS]) {
            if (!node.$url) {
                Object.defineProperty(node, '$url', {
                    value: new URL(node.getAttribute('href'), window.location.href/*not origin*/)
                });
            }
            if (_matchUrl(event, node.$url.pathname)) {
                _count += await this.mutateNode(event, node, this.#removedCSS);
            }
        }
        return _count;
    }

    async handleAffectedHTMLModules(event) {
        const topLevelModules = document.querySelectorAll(this.#selectors.remoteHtmlModule);
        return await (async function eat(contextNode, $contextPath, modules, level = 0) {
            if (!this.#removedHTML.has($contextPath)) {
                this.#removedHTML.set($contextPath, new Set);
            }
            const removedHTML = this.#removedHTML.get($contextPath);
            let _count = 0;
            for (const node of [...modules, ...removedHTML]) {
                const $def = node.getAttribute('def');
                const $defPath = $contextPath ? `${$contextPath === '/' ? '' : $contextPath}/${$def}` : null;
                // Match remote modules
                if (node.matches(this.#selectors.remoteHtmlModule)) {
                    if (!node.$url) {
                        Object.defineProperty(node, '$url', {
                            value: new URL(node.getAttribute('src'), window.location.href/*not origin*/)
                        });
                    }
                    if (node.$url.pathname === event.$target.pathname) {
                        // The referenced bundle file has been directly mutated
                        _count += await this.mutateNode(event, node, removedHTML, true);
                        continue;
                    }
                    const srcDir = _dirname(node.$url.pathname);
                    if (srcDir === '/' || event.$target.pathname.startsWith(`${srcDir}/`)) {
                        // Target is a file within current bundle. So we recurse
                        _count += await eat.call(this, node, srcDir, [...node.content.children], level + 1);
                        continue;
                    }
                }
                if ($defPath === event.$target.pathname) {
                    // Target (file or directory) exactly matches DEF
                    _count += await this.mutateNode(event, node, removedHTML, async () => {
                        const replacementNode = await this.loadHTMLModule(event.target/*!IMPORTANT*/);
                        if (!replacementNode) return 0;
                        replacementNode.setAttribute?.('def', $def);
                        node.replaceWith(replacementNode);
                        return 1;
                    });
                    continue;
                }
                // Recurse along DEF tree
                if (node.matches(this.#selectors.inlineHtmlModule)) {
                    // Target is a file within current module. So we recurse
                    _count += await eat.call(this, node, $defPath, [...node.content.children], level + 1);
                    continue;
                }
            }
            // Handle module add event
            if (!_count/*no existing node matched*/ && /^add/.test(event.type)/* (addDir | add) */ && (
                contextNode && $contextPath === _dirname(event.$target.pathname)
            )) {
                const newNode = event.type === 'addDir'
                    ? document.createElement('template')
                    : await this.loadHTMLModule(event.target/*!IMPORTANT*/);
                if (newNode) {
                    newNode.setAttribute?.('def', _basename(event.$target.pathname));
                    contextNode.content.appendChild(newNode);
                    _count++;
                }
            }
            return _count;
        }).call(this, [...topLevelModules][0], '', topLevelModules);
    }

    async mutateNode(event, node, removedNodes, customRefresh = null) {
        // (unlink | unlinkDir)
        if (/^unlink/.test(event.type)) {
            node.$previousSibling = node.previousSibling;
            removedNodes.add(node);
            node.remove();
            return 1;
        }
        // (add | addDir)
        if (/^add/.test(event.type)) {
            if (node.$previousSibling) {
                node.$previousSibling.after(node);
                removedNodes.delete(node);
                return 1;
            }
            return 0;
        }
        // (change)
        if (!node.$url) {
            return await customRefresh(node);
        }
        const $url = node.$url;
        const url = encodeURIComponent($url.href.replace(`${$url.origin}/`, '')); // preserving origin query strings
        const urlRewrite = `/@dev?src=${url}&t=${Date.now()}`;
        if (node.matches(this.#selectors.remoteStyleSheet)) {
            node.setAttribute('href', urlRewrite);
            return 1;
        }
        if (node.matches(this.#selectors.remoteHtmlModule)) {
            node.setAttribute('src', urlRewrite);
            return 1;
        }
        return 0
    }

    async loadHTMLModule(url) {
        const urlRewrite = `/@dev?src=${url}?t=${Date.now()}`;
        const fileContents = await fetch(urlRewrite).then((res) => res.text()).catch(() => null);
        if (fileContents === null) return null;
        const temp = document.createElement('template');
        temp.innerHTML = fileContents.trim(); // IMPORTANT: .trim()
        return temp.content.firstElementChild;
    }
}

const _dirname = (path) => {
    const dname = path.replace(/\/[^\/]+$/, '');
    return !dname ? '/' : dname;
};

const _basename = (path) => {
    const bname = path.match(/\/([^\/]+)$/)[1];
    return !bname ? path : bname;
};

const _matchUrl = (event, pathname) => {
    if (/Dir$/.test(event.type)) {
        return pathname.startsWith(`${event.$target.pathname}/`);
    }
    return pathname === event.$target.pathname;
};