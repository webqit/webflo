
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Pm2 from 'pm2';
import _promise from '@webqit/util/js/promise.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import * as server from '../config/server.js'
import Server from '../modules/server/Server.js';

/**
 * @description
 */
export const desc = {
    start: 'Starts the Webflo server. (--p or --prod to run as a background process.)',
    stop: 'Stops a Webflo background process.',
    restart: 'Restarts a Webflo background process that has been stopped.',
    processes: 'Lists all Webflo background processes.',
};

/**
 * @start
 */
export async function start(Ui, flags, params = {}) {
    const config = await server.read(params);
    config.ROOT = process.cwd();
    const currentDir = Path.dirname(Url.fileURLToPath(import.meta.url));
     // -------------------
    // Splash screen
    // -------------------
    const showRunning = (processName = null, processAutoRestart = false) => {
        // -------------------
        // Splash screen
        // -------------------
        const WEBFLO = DotJson.read(Path.join(currentDir, '../package.json'));
        Ui.banner(WEBFLO.title, WEBFLO.version);
        Ui.log('');
        Ui.log(Ui.f`${'-------------------------------'}`);
        Ui.log('');
        Ui.log(Ui.f`${{PORT: config.PORT, PUBLIC_DIR: config.PUBLIC_DIR, SERVER_DIR: config.SERVER_DIR, }}`);
        Ui.log('');
        Ui.log(Ui.f`${'-------------------------------'}`);
        Ui.log('');
        if (processName) {
            Ui.success(`Server running in ${Ui.style.keyword('production')}; ${(processAutoRestart ? 'will' : 'wo\'nt')} autorestart on crash!`);
            Ui.info(Ui.f`Process name: ${processName}`);
            Ui.log('');
            Ui.log(Ui.f`${'-------------------------------'}`);
        }

    };
    const runtimeMode = flags.prod ? 'prod' : (flags.dev ? 'dev' : config.RUNTIME_MODE);
    if (config.RUNTIME_MODE !== runtimeMode) {
        config.RUNTIME_MODE = runtimeMode;
    }
    if (runtimeMode === 'prod') {
        return new Promise(resolve => {
            Pm2.connect(err => {
                if (err) {
                    Ui.error(err);
                    resolve();
                } else {

                    var script = Path.resolve(currentDir, '../modules/server/start.mjs'),
                        name = config.RUNTIME_NAME,
                        args = Object.keys(flags).map(f => '--' + f),
                        exec_mode = 'fork',
                        autorestart = 'AUTO_RESTART' in config ? config.AUTO_RESTART : true,
                        merge_logs = 'MERGE_LOGS' in config ? config.MERGE_LOGS : true,
                        output = Path.resolve('./.webflo/runtime/output.log'),
                        error = Path.resolve('./.webflo/runtime/error.log');
                    Pm2.start({script, name, args, exec_mode, autorestart, merge_logs, output, error, force: true}, err => {
                        if (err) {
                            Ui.error(err);
                        } else {
                            Ui.log('');
                            showRunning(name, autorestart);
                        }
                        Pm2.disconnect(resolve);
                    });
                }
            });
        });    
    }
    await Server.call(null, Ui, config);
    showRunning();
};

/**
 * ----------
 * Stops a pm2 instance
 * ----------
 */
export function stop(Ui, name, flags = {}) {
    return new Promise(resolve => {
        const cb =  err => {
            if (err) {
                Ui.error(err);
            } else {
                Ui.success(Ui.f`Server ${flags.kill ? 'killed' : 'stopped'}: ${name}`);
            }
            resolve();
        };
        if (flags.kill) {
            Pm2.kill(name, cb);
        } else {
            Pm2.stop(name, cb);
        }
    });
};

/**
 * ----------
 * Restarts a pm2 instance
 * ----------
 */
export function restart(Ui, name, flags = {}) {
    return new Promise(resolve => {
        Pm2.restart(name, err => {
            if (err) {
                Ui.error(err);
            } else {
                Ui.success(Ui.f`Server restarted: ${name}`);
            }
            resolve();
        });
    });
};

/**
 * ----------
 * Lists pm2 instances
 * ----------
 */
export function processes(Ui, flags = {}) {
    return new Promise(resolve => {
        Pm2.list((err, list) => {
            if (err) {
                Ui.error(err);
                resolve();
            } else {
                resolve(list.map(p => ({
                    name: p.name,
                    status: p.pm2_env.status,
                    instances: p.pm2_env.instances,
                    uptime: p.pm2_env.pm_uptime,
                    created: p.pm2_env.created_at,
                })));
            }
        });
    });
};
