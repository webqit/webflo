import Path from 'path';
import chokidar from 'chokidar';
import { exec, spawn } from 'child_process';
import { platform } from 'os';

export class WebfloHMR {

    static manage(app, options = {}) {
        return new this(app, options);
    }

    #app;

    #options;
    get options() { return this.#options; }

    #jsMeta = {
        dependencyMap: null/*!IMPORTANT!*/,
        mustRevalidate: true,
        prevBuildResult: null,
    };

    #layoutDirsMatchMap;
    #routeDirs;
    #handlerMatch;

    #clients = new Set;
    get clients() { return this.#clients; }

    #watcher;
    get watcher() { return this.#watcher; }

    #dirtiness = {
        CSSAffected: false,
        HTMLAffected: false,
        clientRoutesAffected: new Set,
        serviceWorkerAffected: false,
    };
    get dirtiness() { return this.#dirtiness; }

    #ignoreList = new Set;
    get ignoreList() { return this.#ignoreList; }

    #eventQueue = [];

    constructor(app, options = {}) {
        this.#app = app;
        this.#options = options;
        // Filesytem matching
        const _layoutDirPattern = (dirs) => `^(${[...dirs].map((d) => Path.relative(process.cwd(), d).replace(/^\.\//g, '').replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|')})`;
        this.#layoutDirsMatchMap = Object.fromEntries(['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'VIEWS_DIR', 'PUBLIC_DIR'].map((name) => {
            return [name, new RegExp(_layoutDirPattern([app.config.LAYOUT[name]]))];
        }));
        this.#routeDirs = new Set([app.config.LAYOUT.CLIENT_DIR, app.config.LAYOUT.WORKER_DIR, app.config.LAYOUT.SERVER_DIR]);
        this.#handlerMatch = new RegExp(`${_layoutDirPattern(this.#routeDirs)}(\\/.+)?\\/handler(?:\\.(client|worker|server))?\\.js$`);
        // The watch and event ordering logic
        const totalWatchDirs = new Set([...this.#routeDirs, app.config.LAYOUT.VIEWS_DIR, app.config.LAYOUT.PUBLIC_DIR]);
        this.#watcher = chokidar.watch([...totalWatchDirs], { ignoreInitial: true });
        let flushTimer;
        const scheduleFlush = () => {
            clearTimeout(flushTimer);
            flushTimer = setTimeout(() => this.#flushEvents(), EVENT_FLUSH_DELAY);
        };
        const EVENT_FLUSH_DELAY = 200; // milliseconds
        this.#watcher.on('all', async (type, $target) => {
            if (!['unlink', 'add', 'change', 'addDir', 'unlinkDir'].includes(type)) return;
            this.#eventQueue.push({ type, $target });
            scheduleFlush();
        });
    }

    async #flushEvents() {
        // Sort by event priority and path depth (deepest files first for unlinks)
        // The Dir events are for structuring purposes
        const priority = {
            unlink: 1,
            unlinkDir: 2,
            addDir: 3,
            add: 4
        };
        const eventQueue = this.#eventQueue.splice(0).sort((a, b) => {
            if (priority[a.type] !== priority[b.type]) {
                return priority[a.type] - priority[b.type];
            }
            return b.$target.split('/').length - a.$target.split('/').length; // deeper first
        });
        const events = new Set;
        let hasJustBeenRebuilt = false;
        for (const { type, $target } of eventQueue) {
            if (this.#ignoreList.has($target)) continue;
            const target = Path.relative(process.cwd(), $target);
            if (this.#layoutDirsMatchMap.PUBLIC_DIR.test(target)) { // Assets
                if (target.endsWith('.css')) {
                    events.add({ type, target, fileType: 'css', kind: 'asset' });
                }
            }
            if (this.#layoutDirsMatchMap.VIEWS_DIR.test(target)) { // Views
                if (/Dir$/.test(type)) { // (addDir | unlinkDir)
                    events.add({ type, target, fileType: null, kind: 'view' });
                } else if (target.endsWith('.html')) {
                    events.add({ type, target, fileType: 'html', kind: 'view' });
                }
            }
            if (target.endsWith('.js')) {
                if (/add|unlink/.test(type)) {
                    this.#jsMeta.mustRevalidate = true; // Invalidate graph
                }
                if ((!hasJustBeenRebuilt && type !== 'unlink') || !this.#jsMeta.dependencyMap) { // We need graph in place to process affected routes for an unlink event
                    await this.buildRoutes(this.#jsMeta.mustRevalidate/*fullBuild*/);
                    hasJustBeenRebuilt = true;
                }
                const affectedHandlers = this.#jsMeta.dependencyMap[target] || [];
                for (const affectedHandler of affectedHandlers) {
                    const [, dir, affectedRoute = '/', realm] = this.#handlerMatch.exec(affectedHandler) || [];
                    for (const r of ['client', 'worker', 'server']) {
                        const scopeObj = {};
                        if (type === 'unlink' && realm === r && target === affectedHandler // Dedicated handlers directly removed. Calculate fallback!
                            && (scopeObj.genericHandler = _toGeneric(target)) in this.#jsMeta.dependencyMap) {
                            // A fallback to generic handler happened
                            events.add({ type, target, fileType: 'js', affectedRoute, affectedHandler: scopeObj.genericHandler, realm: r, actionableEffect: 'change' });
                        } else if (realm === r || !realm/*generic handler*/ && (
                            this.#layoutDirsMatchMap[`${r.toUpperCase()}_DIR`].test(dir) && !(_toDedicated(target, r) in this.#jsMeta.dependencyMap)/*no dedicated handler exists*/
                        )) {
                            const actionableEffect = target === affectedHandler ? type : 'change';
                            events.add({ type, target, fileType: 'js', affectedRoute, affectedHandler, realm: r, actionableEffect });
                        }
                    }
                }
            }
        }
        if (events.size) {
            this.fire(events);
        }
    }

    async fire(events) {
        for (const event of events) {
            if (event.realm === 'client') {
                this.#dirtiness.clientRoutesAffected.add(event.affectedRoute);
            } else if (event.realm === 'worker') {
                this.#dirtiness.serviceWorkerAffected = true;
            } else if (event.realm === 'server') {
                if (/^unlink/.test(event.actionableEffect)) {
                    delete this.#app.routes[event.affectedRoute];
                } else if (event.realm === 'server') {
                    this.#app.routes[event.affectedRoute] = `${Path.join(this.#app.config.RUNTIME_DIR, event.affectedHandler)}?_webflohmrhash=${Date.now()}`;
                }
            } else if (event.fileType === 'css') {
                this.#dirtiness.CSSAffected = true;
            } else if (event.fileType === 'html' || !event.fileType) {
                this.#dirtiness.HTMLAffected = true;
            }
        }
        if (this.#options.buildSensitivity === 2) {
            await this.bundleAssetsIfPending();
        }
        // Broadcast to clients
        const PUBLIC_DIR = Path.relative(process.cwd(), this.#app.config.LAYOUT.PUBLIC_DIR);
        const $events = [...events].map((event) => {
            const $event = { ...event };
            $event.target = Path.relative(PUBLIC_DIR, event.target);
            if (event.affectedHandler) {
                $event.affectedHandler = Path.relative(PUBLIC_DIR, event.affectedHandler);
            }
            return $event;
        });

        for (const client of this.#clients) {
            client.send(JSON.stringify($events));
        }
    }

    async buildRoutes(fullBuild = false) {
        // 0. Generate graph
        let buildResult;
        try {
            if (this.#jsMeta.prevBuildResult) {
                if (fullBuild) await this.#jsMeta.prevBuildResult.rebuild.dispose();
                else buildResult = await buildResult.rebuild();
            }``
            if (!buildResult) {
                const bundlingConfig = {
                    client: true,
                    worker: true,
                    server: true,
                    metafile: true,      // This is key
                    logLevel: 'silent',  // Suppress output
                    incremental: true,
                };
                buildResult = await this.#app.buildRoutes(bundlingConfig);
            }
        } catch (e) {
            //console.error(e);
            return false;
        }

        // 1. Forward dependency graph (file -> [imported files])
        const forward = {};
        for (const [file, data] of Object.entries(buildResult.metafile.inputs)) {
            forward[file] = data.imports?.map((imp) => Path.normalize(imp.path)) || [];
        }

        // 2. Reverse dependency graph (file -> [parents])
        const reverse = {};
        for (const [file, imports] of Object.entries(forward)) {
            for (const dep of imports) {
                if (!reverse[dep]) reverse[dep] = [];
                reverse[dep].push(file);
            }
        }

        // 3. Trace from leaf file to roots (handler files)
        const handlers = Object.keys(buildResult.metafile.inputs).filter((f) => this.#handlerMatch.test(f));
        const handlerDepsMap = {};

        for (const handler of handlers) {
            const visited = new Set();
            const stack = [handler];
            while (stack.length) {
                const current = stack.pop();
                if (visited.has(current)) continue;
                visited.add(current);
                if (!handlerDepsMap[current]) handlerDepsMap[current] = [];
                handlerDepsMap[current].push(handler);
                const deps = forward[current] || [];
                stack.push(...deps);
            }
        }
        this.#jsMeta.dependencyMap = handlerDepsMap;
        this.#jsMeta.mustRevalidate = false;
        
        return true;
    }

    async bundleAssetsIfPending(ohForce = false) {
        const entries = {};

        if (this.#dirtiness.clientRoutesAffected.size || this.#dirtiness.serviceWorkerAffected || ohForce) {
            entries.js = {};
            entries.js.client = !!this.#dirtiness.clientRoutesAffected.size || ohForce;
            entries.js.worker = this.#dirtiness.serviceWorkerAffected || ohForce;
            entries.js.server = false;
            // Clear state
            this.#dirtiness.clientRoutesAffected.clear();
            this.#dirtiness.serviceWorkerAffected = false;
        }

        if (this.#dirtiness.HTMLAffected || ohForce) {
            this.#dirtiness.HTMLAffected = false;
            entries.html = {};
        }

        if (this.#dirtiness.CSSAffected || ohForce) {
            this.#dirtiness.CSSAffected = false;
            entries.css = {};
        }

        for (const e in entries) {
            const buildKey = `build:${e}`;
            let buildScriptName = this.#options.buildScripts?.[buildKey];
            if (buildScriptName === true) {
                buildScriptName = buildKey;
            }
            let buildScript;
            if (buildScriptName
                && (buildScript = this.#options.appMeta.scripts?.[buildScriptName])) {
                await this.#spawnProcess(buildScript, entries[e]);
            }
        }
    }

    async #spawnProcess(command, options = {}) {
        const $options = Object.fromEntries(Object.entries(options).map(([k, v]) => [`--${k}`, v]));
        const commandArr = [...new Set(
            command.split(/\s+?/).concat(Object.keys($options)).filter((s) => !(s in $options) || $options[s])
        )];
        return await new Promise((resolve, reject) => {
            const child = spawn(commandArr.shift(), commandArr, {
                stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
                shell: true, // for Windows compatibility
            });
            child.on('message', (msg) => {
                for (const file of msg?.outfiles || []) {
                    this.#ignoreList.add(file);
                }
            });
            child.on('exit', (code) => {
                if (code === 0) resolve(child);
                else reject(new Error(`Process exited with code ${code}`));
            });
        });
    }
}

const _toGeneric = (file) => {
    return file.replace(/\.(client|worker|server)\.js$/, '.js');
};

const _toDedicated = (file, suffix) => {
    return file.replace(/\.js$/, `.${suffix}.js`);
};

export function openBrowser(url) {
    const plat = platform();
    let command;
    if (plat === 'darwin') {
        command = `open "${url}"`;
    } else if (plat === 'win32') {
        command = `start "" "${url}"`;
    } else if (plat === 'linux') {
        command = `xdg-open "${url}"`;
    } else {
        console.warn('🌐 Unable to auto-open browser on this platform.');
        return;
    }
    exec(command, (err) => {
        if (err) console.error('❌ Failed to open browser:', err);
    });
}