import EsBuild from 'esbuild';
import chokidar from 'chokidar';
import $glob from 'fast-glob';
import Path from 'path';

export async function WebfloHMR(app, fire) {
    // Filesytem matching
    const layoutDirPattern = (dirs) => `^(${[...dirs].map((d) => Path.relative(process.cwd(), d).replace(/^\.\//g, '').replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|')})`;
    const layoutDirsMatchMap = Object.fromEntries(['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'PUBLIC_DIR'].map((name) => {
        return [name, new RegExp(layoutDirPattern([app.config.LAYOUT[name]]))];
    }));
    const routeDirs = new Set([app.config.LAYOUT.CLIENT_DIR, app.config.LAYOUT.WORKER_DIR, app.config.LAYOUT.SERVER_DIR]);
    const handlerMatch = new RegExp(`${layoutDirPattern(routeDirs)}(\\/.+)?\\/handler(?:\\.(client|worker|server))?\\.js$`);
    // Initial graph state
    const graphCache = {
        hmrDependenciesMap: {},
        lastUnlinkButPossibleRename: null,
        mustRevalidate: true
    };
    // The watch logic
    const watcher = chokidar.watch([...routeDirs, app.config.LAYOUT.PUBLIC_DIR], { ignoreInitial: true });
    watcher.on('all', async (type, $changedFile) => {
        if (!['unlink', 'add', 'change', 'rename'].includes(type)) return;
        const changedFile = Path.relative(process.cwd(), $changedFile);
        if (changedFile.endsWith('.js')) {
            // Is JS asset?
            if (layoutDirsMatchMap.PUBLIC_DIR.test(changedFile)) {
                fire({ type, changedFile, fileType: 'js', kind: 'asset' });
                return;
            }
            // Trigger deps rebuild?
            if ((type === 'add' && changedFile !== graphCache.lastUnlinkButPossibleRename)/*on a real add*/
                || type === 'rename'/*just in case fired*/) {
                graphCache.mustRevalidate = true; // Invalidate entire
            }
            if (graphCache.mustRevalidate) {
                const hmrDependenciesMap = await generateHMRDependenciesGraph(routeDirs, handlerMatch, true/*fullBuild*/);
                if (hmrDependenciesMap) {
                    graphCache.hmrDependenciesMap = hmrDependenciesMap;
                    graphCache.mustRevalidate = false;
                }
            }
            const affectedHandlers = graphCache.hmrDependenciesMap[changedFile] || [];
            for (const affectedHandler of affectedHandlers) {
                const [, dir, affectedRoute = '/', realm] = handlerMatch.exec(affectedHandler) || [];
                for (const r of ['client', 'worker', 'server']) {
                    if (realm === r || !realm/*generic handler*/ && (
                        layoutDirsMatchMap[`${r.toUpperCase()}_DIR`].test(dir) && !(changedFile.replace(/\.js$/, `.${r}.js`) in graphCache.hmrDependenciesMap)/*no dedicated handler exists*/
                    )) {
                        fire({ type, changedFile, fileType: 'js', affectedRoute, affectedHandler, realm: r, effect: changedFile === affectedHandler ? type : 'change' });
                    }
                }
            }
            if (type === 'unlink') {
                graphCache.lastUnlinkButPossibleRename = changedFile;
                graphCache.mustRevalidate = true; // Invalidate entire
            } else {
                graphCache.lastUnlinkButPossibleRename = null;
            }
        } else if (changedFile.endsWith('.html')) {
            fire({ type, changedFile, fileType: 'html', kind: 'asset' });
        } else if (changedFile.endsWith('.css')) {
            fire({ type, changedFile, fileType: 'css', kind: 'asset' });
        }
    });
}

let prevBuildResult;
async function generateHMRDependenciesGraph(routeDirs, handlerMatch, fullBuild = false) {
    // 0. Generate graph
    let buildResult;
    try {
        if (prevBuildResult) {
            if (fullBuild) await prevBuildResult.rebuild.dispose();
            else buildResult = await buildResult.rebuild();
        }
        if (!buildResult) {
            const entryPoints = await $glob([...routeDirs].map((d) => `${d}/**/handler{,.client,.worker,.server}.js`), { absolute: true })
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
    } catch(e) { return; }
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
    const handlers = Object.keys(buildResult.metafile.inputs).filter((f) => handlerMatch.test(f));
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
