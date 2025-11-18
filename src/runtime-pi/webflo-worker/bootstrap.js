import Fs from 'fs';
import Path from 'path';
import {
    readLayoutConfig,
    readEnvConfig,
    readClientConfig,
    readWorkerConfig,
    scanRoots,
    scanRouteHandlers,
} from '../../deployment-pi/util.js';

export async function bootstrap(cx, offset = '') {
    const $init = Fs.existsSync('./init.worker.js')
        ? Path.resolve('./init.worker.js')
        : null;
    const config = {
        LAYOUT: await readLayoutConfig(cx),
        ENV: await readEnvConfig(cx),
        CLIENT: await readClientConfig(cx),
        WORKER: await readWorkerConfig(cx),
    };
    if (config.CLIENT.copy_public_variables) {
        const publicEnvPattern = /(?:^|_)PUBLIC(?:_|$)/;
        for (const key in process.env) {
            if (publicEnvPattern.test(key)) {
                config.ENV.data[key] = process.env[key];
            }
        }
    }
    const routes = {};
    const $roots = Fs.existsSync(config.LAYOUT.PUBLIC_DIR) ? scanRoots(config.LAYOUT.PUBLIC_DIR, 'manifest.json') : [];
    const $sparoots = Fs.existsSync(config.LAYOUT.PUBLIC_DIR) ? scanRoots(config.LAYOUT.PUBLIC_DIR, 'index.html') : [];
    scanRouteHandlers(config.LAYOUT, 'worker', (file, route) => {
        routes[route] = file;
    }, offset, $roots);
    const outdir = Path.join(config.LAYOUT.PUBLIC_DIR, offset);
    return { $init, config, routes, $roots, $sparoots, outdir, offset };
}
