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
    const $init = Fs.existsSync('./init.client.js')
        ? Path.resolve('./init.client.js')
        : null;
    const config = {
        LAYOUT: await readLayoutConfig(cx),
        ENV: await readEnvConfig(cx),
        CLIENT: await readClientConfig(cx),
        WORKER: await readWorkerConfig(cx),
    };
    if (config.CLIENT.copy_public_variables) {
        const publicEnvPattern = /(?:^|_)PUBLIC(?:_|$)/;
        config.ENV.data = config.ENV.data || {};
        for (const key in process.env) {
            if (publicEnvPattern.test(key)) {
                config.ENV.data[key] = process.env[key];
            }
        }
    }
    const routes = {};
    const $roots = Fs.existsSync(config.LAYOUT.PUBLIC_DIR) ? scanRoots(config.LAYOUT.PUBLIC_DIR, 'index.html') : [];
    scanRouteHandlers(config.LAYOUT, 'client', (file, route) => {
        routes[route] = file;
    }, offset, $roots);
    const outdir = Path.join(config.LAYOUT.PUBLIC_DIR, offset);
    return { $init, config, routes, $roots, $sparoots: $roots, outdir, offset };
}