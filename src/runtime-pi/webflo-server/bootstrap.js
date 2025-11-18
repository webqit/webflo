import Fs from 'fs';
import Path from 'path';
import {
    readServerConfig,
    readHeadersConfig,
    readRedirectsConfig,
    readLayoutConfig,
    readEnvConfig,
    readProxyConfig,
    readWorkerConfig,
    scanRoots,
    scanRouteHandlers,
} from '../../deployment-pi/util.js';
import { start as _start } from './index.js';

export async function bootstrap(cx, offset = '', runtimeMode = false) {
    const $init = Fs.existsSync('./init.server.js')
        ? Path.resolve('./init.server.js')
        : null;
    const config = {
        LAYOUT: await readLayoutConfig(cx),
        ENV: await readEnvConfig(cx),
        SERVER: await readServerConfig(cx),
        HEADERS: await readHeadersConfig(cx),
        REDIRECTS: await readRedirectsConfig(cx),
        PROXY: await readProxyConfig(cx),
        WORKER: await readWorkerConfig(cx),
    };
    config.RUNTIME_LAYOUT = { ...config.LAYOUT };
    config.RUNTIME_DIR = Path.join(process.cwd(), '.webqit/webflo/@runtime');
    if (runtimeMode) {
        for (const name of ['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'VIEWS_DIR', 'PUBLIC_DIR']) {
            const originalDir = Path.relative(process.cwd(), config.LAYOUT[name]);
            config.RUNTIME_LAYOUT[name] = `${config.RUNTIME_DIR}/${originalDir}`;
        }
    }
    const routes = {};
    const { PROXY } = config;
    const $roots = PROXY.entries.map((proxy) => proxy.path?.replace(/^\.\//, '')).filter((p) => p);
    const $sparoots = Fs.existsSync(config.LAYOUT.PUBLIC_DIR) ? scanRoots(config.LAYOUT.PUBLIC_DIR, 'index.html') : [];
    const cwd = cx.CWD || process.cwd();
    scanRouteHandlers(config.LAYOUT, 'server', (file, route) => {
        routes[route] = runtimeMode 
            ? Path.join(config.RUNTIME_DIR, Path.relative(cwd, file))
            : file;
    }, offset, $roots);
    const outdir = Path.join(config.RUNTIME_DIR, offset);
    return { $init, config, routes, $roots, $sparoots, outdir, offset };
}

export async function start() {
    const cx = this || {};
    const { $init, ...$bootstrap } = await bootstrap(cx, '', true);

    let init = null;
    if ($init) init = await import($init);

    return _start({ init, cx, ...$bootstrap });
}