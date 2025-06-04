import EsBuild from 'esbuild';
import chokidar from 'chokidar';
import $glob from 'fast-glob';
import Path from 'path';

export class WebfloHMR {

    static manage(app) {
        return new this(app);
    }

    #app;

    #jsMeta = {
        dependencyMap: {},
        lastUnlinkButPossibleRename: null,
        mustRevalidate: true,
        prevBuildResult: null,
    };

    #routeDirs;
    #handlerMatch;

    #clients = new Set;
    get clients() { return this.#clients; }

    #watcher;
    get watcher() { return this.#watcher; }

    constructor(app) {
        this.#app = app;
        // Filesytem matching
        const _layoutDirPattern = (dirs) => `^(${[...dirs].map((d) => Path.relative(process.cwd(), d).replace(/^\.\//g, '').replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|')})`;
        const layoutDirsMatchMap = Object.fromEntries(['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'PUBLIC_DIR'].map((name) => {
            return [name, new RegExp(_layoutDirPattern([app.config.LAYOUT[name]]))];
        }));
        this.#routeDirs = new Set([app.config.LAYOUT.CLIENT_DIR, app.config.LAYOUT.WORKER_DIR, app.config.LAYOUT.SERVER_DIR]);
        this.#handlerMatch = new RegExp(`${_layoutDirPattern(this.#routeDirs)}(\\/.+)?\\/handler(?:\\.(client|worker|server))?\\.js$`);
        // The watch logic
        this.#watcher = chokidar.watch([...this.#routeDirs, app.config.LAYOUT.PUBLIC_DIR], { ignoreInitial: true });
        this.#watcher.on('all', async (type, $target) => {
            if (!['unlink', 'add', 'change', 'rename', 'addDir', 'unlinkDir'].includes(type)) return;
            const target = Path.relative(process.cwd(), $target);
            const events = new Set;
            // Handle assets and routes differently
            if (layoutDirsMatchMap.PUBLIC_DIR.test(target)) { // Assets
                if (/Dir$/.test(type)) { // (addDir | unlinkDir)
                    events.add({ type, target, fileType: null, kind: 'asset' });
                } else if (target.endsWith('.js')) {
                    events.add([{ type, target, fileType: 'js', kind: 'asset' }]);
                } else if (target.endsWith('.html')) {
                    events.add({ type, target, fileType: 'html', kind: 'asset' });
                } else if (target.endsWith('.css')) {
                    events.add({ type, target, fileType: 'css', kind: 'asset' });
                }
            } else if (target.endsWith('.js') || /Dir$/.test(type)/* (addDir | unlinkDir) */) { // Routes
                // Trigger deps rebuild on an addition operation that isn't the next step of a rename operation
                if ((/^add/.test(type) && target !== this.#jsMeta.lastUnlinkButPossibleRename)/*on a real add*/
                    || type === 'rename'/*just in case fired*/) {
                    this.#jsMeta.mustRevalidate = true; // Invalidate entire
                }
                // Unlink-induced rebuilds are deferred
                if (!/^unlink/.test(type)) { // We need graph in place to match affected routes for an unlink event
                    const dependencyMap = await this.#generateHMRDependenciesGraph(this.#jsMeta.mustRevalidate/*fullBuild*/);
                    if (dependencyMap) {
                        this.#jsMeta.dependencyMap = dependencyMap;
                        this.#jsMeta.mustRevalidate = false;
                    }
                }
                // Handle handler-affecting events
                const affectedHandlers = !/Dir$/.test(type) // !(addDir | unlinkDir)
                    // Find all affected handlers for the given file
                    ? (this.#jsMeta.dependencyMap[target] || [])
                    // Find all affected handlers for the given directory
                    : Object.entries(this.#jsMeta.dependencyMap).reduce((allAffectedHandlers, [file, affectedHandlers]) => {
                        if (file.startsWith(`${target}/`)) {
                            return allAffectedHandlers.concat(affectedHandlers);
                        }
                        return allAffectedHandlers;
                    }, []);
                for (const affectedHandler of affectedHandlers) {
                    const [, dir, affectedRoute = '/', realm] = this.#handlerMatch.exec(affectedHandler) || [];
                    for (const r of ['client', 'worker', 'server']) {
                        const scopeObj = {};
                        if (type === 'unlink' && realm === r && target === affectedHandler // Dedicated handlers directly removed. Calculate fallback!
                            && (scopeObj.genericHandler = _toGeneric(target)) in this.#jsMeta.dependencyMap) {
                            // A fallback to generic handler happened
                            events.add({ type, target, fileType: 'js', affectedRoute, affectedHandler: scopeObj.genericHandler, realm: r, effect: 'change' });
                        } else if (realm === r || !realm/*generic handler*/ && (
                            layoutDirsMatchMap[`${r.toUpperCase()}_DIR`].test(dir) && !(_toDedicated(target, r) in this.#jsMeta.dependencyMap)/*no dedicated handler exists*/
                        )) {
                            let actionableEffect; // Let's indicated directly mutated vs indirectly mutated handlers
                            if (/Dir$/.test(type)) { // (addDir | unlinkDir)
                                actionableEffect = affectedHandler.startsWith(`${target}/`) ? type : 'change';
                            } else {
                                actionableEffect = target === affectedHandler ? type : 'change';
                            }
                            events.add({ type, target, fileType: 'js', affectedRoute, affectedHandler, realm: r, actionableEffect });
                        }
                    }
                }
                if (/^unlink/.test(type)) { // (unlink | unlinkDir)
                    this.#jsMeta.lastUnlinkButPossibleRename = target;
                    this.#jsMeta.mustRevalidate = true; // Invalidate entire
                } else {
                    this.#jsMeta.lastUnlinkButPossibleRename = null;
                }
            }
            if (events.size) {
                this.fire(events);
            }
        });
    }

    async fire(events) {
        console.log(events);
        // Execute server HMR?
        for (const event of events) {
            if (!event.affectedRoute) continue;
            if (/^unlink/.test(event.actionableEffect) && event.realm === 'server') {
                delete this.#app.routes[event.affectedRoute];
            } else if (event.realm === 'server') {
                this.#app.routes[event.affectedRoute] = `${Path.join(process.cwd(), event.affectedHandler)}?_webflohmrhash=${Date.now()}`;
            }
        }
        // Broadcast to clients
        const PUBLIC_DIR = Path.relative(process.cwd(), this.#app.config.LAYOUT.PUBLIC_DIR);
        const $events = [...events].map((event) => {
            const $event = { ...event };
            $event.target = Path.relative(PUBLIC_DIR, event.target);
            if (event.affectedHandler) {
                $event.affectedHandler = Path.relative(PUBLIC_DIR, event.affectedHandler);
            }
        });
        for (const client of this.#clients) {
            client.send(JSON.stringify($events));
        }
    }

    async #generateHMRDependenciesGraph(fullBuild = false) {
        // 0. Generate graph
        let buildResult;
        try {
            if (this.#jsMeta.prevBuildResult) {
                if (fullBuild) await this.#jsMeta.prevBuildResult.rebuild.dispose();
                else buildResult = await buildResult.rebuild();
            }
            if (!buildResult) {
                const entryPoints = await $glob([...this.#routeDirs].map((d) => `${d}/**/handler{,.client,.worker,.server}.js`), { absolute: true })
                    .then((files) => files.map((file) => file.replace(/\\/g, '/')));
                const bundlingConfig = {
                    entryPoints,
                    bundle: true,
                    format: 'esm',
                    platform: 'browser', // optional but good for clarity
                    metafile: true,
                    write: false,        // ❗ Don't emit files
                    outdir: '.webqit/webflo',        // Unexpectedly still required
                    treeShaking: true,   // Optional optimization
                    logLevel: 'silent',  // Suppress output
                    minify: false,
                    sourcemap: false,
                    incremental: true,
                };
                buildResult = await EsBuild.build(bundlingConfig);
            }
        } catch (e) { return; }
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
        return handlerDepsMap;
    }
}

const _toGeneric = (file) => {
    return file.replace(new RegExp(`\\.(client|worker|server)\\.js$`), '.js');
};

const _toDedicated = (file, suffix) => {
    return file.replace(/\.js$/, `.${suffix}.js`);
};

const _dirname = (path) => {
    return path.replace(/\/[^\/]+$/, '');
};

const _basename = (path) => {
    return path.match(/\/([^\/]+)$/)[1];
};