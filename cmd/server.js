
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
    if (config.RUNTIME_MODE !== 'production' && !flags.prod && !flags.p) {
        await Server.call(null, Ui, config);
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
    } else {
        await _promise(resolve => {
            Pm2.connect(err => {
                if (err) {
                    Ui.error(err);
                    resolve();
                } else {

                    var configFile = Path.resolve('./.webflo/config/server.json');
                    var script = Path.resolve(Url.fileURLToPath(currentDir), '../modules/server/pm2starter.js'),
                        args = configFile,
                        name = config.RUNTIME_NAME,
                        autorestart = 'AUTO_RESTART' in config ? config.AUTO_RESTART : true,
                        merge_logs = 'MERGE_LOGS' in config ? config.MERGE_LOGS : true,
                        output = Path.resolve('./.webflo/runtime/output.log'),
                        error = Path.resolve('./.webflo/runtime/error.log');
                    Pm2.start({script, name, args, autorestart, merge_logs, output, error, force: true}, err => {
                        if (err) {
                            Ui.error(err);
                        } else {
                            Ui.log('');
                            Ui.success(`Server running in ${Ui.style.keyword('production')}; ${(autorestart ? 'will' : 'wo\'nt')} autorestart on crash!`);
                            Ui.info(Ui.f`Instance name: ${name}`);
                        }
                        Pm2.disconnect(resolve);
                    });
                }
            });
        });    
    }
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
