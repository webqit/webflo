import EsBuild from 'esbuild';
import chokidar from 'chokidar';
import Glob from 'fast-glob';
import Path from 'path';

export async function WebfloHMR(app, broadcast) {
    async function hmr(payload) {
        if (payload.kind === 'handler') {
            if (payload.type === 'server') {
                await import(`${payload.changedFile}?t=${Date.now()}`);
                return;
            }
            broadcast(payload);
        }
    }
    // Filesytem matching
    const layoutDirPattern = (dirs) => `^(${[...dirs].map((d) => d.replace(/^\.\//g, '').replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|')})`;
    const layoutDirsMatchMap = Object.fromEntries(['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'PUBLIC_DIR'].map((name) => {
        return [name, new RegExp(layoutDirPattern([app.cx.layout[name]]))];
    }));
    const routeDirs = new Set([app.cx.layout.CLIENT_DIR, app.cx.layout.WORKER_DIR, app.cx.layout.SERVER_DIR]);
    const handlerMatch = new RegExp(`${layoutDirPattern(routeDirs)}(\\/.+)?\\/handler(?:\\.(client|worker|server))?\\.js$`);
    // Watcher
    const watcher = chokidar.watch([...routeDirs, app.cx.layout.PUBLIC_DIR], { ignoreInitial: true });
    // Initial JS build
    let hmrDependenciesMap = await generateHMRDependenciesGraph(routeDirs, handlerMatch);
    let lastUnlinkButPossibleRename = null;
    watcher.on('all', async (event, changedFile) => {
        if (!['add', 'change', 'unlink', 'rename'].includes(event)) return;
        if (changedFile.endsWith('.js')) {
            // Is JS asset?
            if (layoutDirsMatchMap.PUBLIC_DIR.test(changedFile)) {
                hmr({ event, kind: 'asset', type: 'js', changedFile });
                return;
            }
            // Trigger deps rebuild?
            if ((event === 'add' && changedFile !== lastUnlinkButPossibleRename)/*on a real add*/
                || event === 'rename'/*just in case fired*/) {
                hmrDependenciesMap = await generateHMRDependenciesGraph(routeDirs, handlerMatch, true);
            }
            const affectedRoutes = hmrDependenciesMap[changedFile] || [];
            for (const routeFile of affectedRoutes) {
                const [, dir, route = '/', type] = handlerMatch.exec(routeFile) || [];
                if (type === 'client' ||/*generic handler*/ (layoutDirsMatchMap.CLIENT_DIR.test(dir) && !(changedFile.replace(/\.js$/, '.client.js') in scopeObj.hmrDependenciesMap)/*no dedicated handler exists*/)) {
                    hmr({ event, kind: 'handler', type: 'client', route, changedFile });
                } else if (type === 'worker' ||/*generic handler*/ (layoutDirsMatchMap.WORKER_DIR.test(dir) && !(changedFile.replace(/\.js$/, '.worker.js') in scopeObj.hmrDependenciesMap)/*no dedicated handler exists*/)) {
                    hmr({ event, kind: 'handler', type: 'worker', route, changedFile });
                } else if (type === 'server' ||/*generic handler*/ (layoutDirsMatchMap.SERVER_DIR.test(dir) && !(changedFile.replace(/\.js$/, '.server.js') in scopeObj.hmrDependenciesMap)/*no dedicated handler exists*/)) {
                    hmr({ event, kind: 'handler', type: 'server', route, changedFile });
                }
            }
            if (event === 'unlink') {
                hmrDependenciesMap = await generateHMRDependenciesGraph(routeDirs, handlerMatch, true);
                lastUnlinkButPossibleRename = changedFile;
            } else lastUnlinkButPossibleRename = null;
        } else if (routeFile.endsWith('.html')) {
            //hmr({ event, kind: 'asset', type: 'css', changedFile });
        } else if (routeFile.endsWith('.css')) {
            hmr({ event, kind: 'asset', type: 'css', changedFile });
        }
    });
}

let prevBuildResult;
async function generateHMRDependenciesGraph(routeDirs, handlerMatch, fullBuild = false) {
    // 0. Generate graph
    let buildResult;
    if (prevBuildResult) {
        if (fullBuild) await prevBuildResult.rebuild.dispose();
        else buildResult = await buildResult.rebuild();
    }
    if (!buildResult) {
        const entryPoints = await Glob([...routeDirs].map((d) => `${d}/**/handler{,.client,.worker,.server}.js`), { absolute: true })
            .then((files) => files.map((file) => file.replace(/\\/g, '/')));
        const bundlingConfig = {
            entryPoints,
            bundle: true,
            format: 'esm',
            platform: 'browser', // optional but good for clarity
            metafile: true,
            write: false,        // ❗ Don't emit files
            treeShaking: true,   // Optional optimization
            logLevel: 'silent',  // Suppress output
            minify: false,
            sourcemap: false,
            incremental: true,
        };
        buildResult = await EsBuild.build(bundlingConfig);
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
