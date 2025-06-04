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
        const flags = {
            currentRouteAffected: false,
            serviceWorkerAffected: false,
            cssCount: 0,
            htmlCount: 0,
        };
        for (const { ...event } of events) {
            if (event.affectedRoute) {
                if (event.realm === 'client') {
                    await this.handleAffectedRoute(event);
                } else if (event.realm === 'worker') {
                    flags.serviceWorkerAffected = true;
                }
                // Now both for realm === client | worker | server
                if (this.#app.location.pathname.startsWith(event.affectedRoute)) {
                    flags.currentRouteAffected = true;
                }
            } else {
                event.$target = new URL(event.target, window.location.origin/*not href*/);
                if (event.fileType === 'css' || /Dir$/.test(event.type)) {
                    flags.cssCount += await handleAffectedStyleSheets(event);
                }
                if (event.fileType === 'html' || /Dir$/.test(event.type)) {
                    flags.htmlCount += await handleAffectedHTMLModules(event);
                }
            }
        }
        if (flags.serviceWorkerAffected) {
            // Update Service Worker first before any reload below
        }
        if (flags.currentRouteAffected) {
            await this.#app.navigate(this.#app.location.href);
        } else if (!flags.cssCount && !flags.htmlCount) {
            window.location.reload();
        }
    }

    async handleAffectedRoute(event) {
        if (/^unlink/.test(event.actionableEffect)) { // (unlink | unlinkDir)
            delete this.#app.routes[event.affectedRoute];
        } else {
            this.#app.routes[event.affectedRoute] = `/@dev?src=${event.affectedHandler}&t=${Date.now()}`;
        }
        return 1;
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
        return await (async function eat(contextNode, $contextPath, modules, isTopLevelModules = false) {
            if (!this.#removedHTML.has($contextPath)) {
                this.#removedHTML.set($contextPath, new Set);
            }
            const removedHTML = this.#removedHTML.get($contextPath);
            let _count = 0;
            for (const node of [...modules, ...removedHTML]) {
                const $def = isTopLevelModules ? '' : node.getAttribute('def');
                const $defPath = `/${[$contextPath, $def].filter((s) => s).join('/')}`;
                // Match remote modules
                if (node.matches(this.#selectors.remoteHtmlModule)) {
                    if (!node.$url) {
                        Object.defineProperty(node, '$url', {
                            value: new URL(node.getAttribute('src'), window.location.href/*not origin*/)
                        });
                    }
                    if (_matchUrl(event, node.$url.pathname)) {
                        // Target is either a file and exactly matches the SRC (current bundle implied)
                        // or a directory accessed by the SRC (the directory of current bundle implied)
                        _count += await this.mutateNode(event, node, removedHTML, true);
                        continue;
                    }
                    if (event.$target.pathname.startsWith(`${_dirname(node.$url.pathname)}/`)) {
                        // Target is a file within current bundle. So we recurse
                        _count += await eat.call(this, node, _dirname(node.$url.pathname), [...node.content]);
                        continue;
                    }
                }
                if ($defPath === event.$target.pathname) {
                    // Target (file or directory) exactly matches DEF
                    _count += await this.mutateNode(event, node, removedHTML, async () => {
                        const replacementNode = await this.loadHTMLModule(`${$contextPath}/${$def}`);
                        replacementNode.setAttribute('def', $def);
                        node.replaceWith(replacementNode);
                        return 1;
                    });
                    continue;
                }
                // Recurse along DEF tree
                if (node.matches(this.#selectors.inlineHtmlModule) && event.$target.pathname.startsWith(`${$defPath}/`)) {
                    // Target is a file within current module. So we recurse
                    _count += await eat.call(this, node, $defPath, [...node.content]);
                    continue;
                }
            }
            // Handle module add event
            if (!_count/*no existing node matched*/ && /^add/.test(event.type)/* (add | addDir) */ && (
                contextNode && $contextPath === _dirname(event.$target.pathname)
            )) {
                const newNode = event.type === 'addDir' 
                    ? document.createElement('template')
                    : await this.loadHTMLModule(event.$target.pathname);
                newNode.setAttribute('def', _basename(event.$target.pathname));
                contextNode.content.append(newNode);
                _count++;
            }
            return _count;
        }).call(this, [...topLevelModules][0], '', topLevelModules, true);
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
    return path.replace(/\/[^\/]+$/, '');
};

const _basename = (path) => {
    return path.match(/\/([^\/]+)$/)[1];
};

const _matchUrl = (event, pathname) => {
    if (/Dir$/.test(event.type)) {
        return pathname.startsWith(`${event.$target.pathname}/`);
    }
    return pathname === event.$target.pathname;
};