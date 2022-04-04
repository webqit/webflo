
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
//import Pm2 from 'pm2';
import _promise from '@webqit/util/js/promise.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import * as server from '../../config/server.js'
import Runtime from './Runtime.js';

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
export async function start(Ui, flags = {}, layout = {}) {
    const config = await server.read(flags, layout);
    const currentDir = Path.dirname(Url.fileURLToPath(import.meta.url));
    const script = Path.resolve(currentDir, './index.mjs');
     // -------------------
    // Splash screen
    // -------------------
    const showRunning = (processName = null, processAutoRestart = false) => {
        // -------------------
        // Splash screen
        // -------------------
        const WEBFLO = DotJson.read(Path.join(currentDir, '../../../package.json'));
        Ui.banner(WEBFLO.title, WEBFLO.version);
        Ui.log('');
        Ui.log(Ui.f`${'-------------------------------'}`);
        Ui.log('');
        const runtimeDetails = {
            HTTP: process.env.PORT ? `${process.env.PORT} (Overriding ${config.port})` : config.port, 
            HTTPS: process.env.PORT2 ? `${process.env.PORT2} (Overriding ${config.https.port || 0})` : config.https.port || 0, 
        };
        if (config.shared) {
            runtimeDetails.MODE = 'Virtual Hosts';
        } else {
            runtimeDetails.PUBLIC_DIR = layout.PUBLIC_DIR;
            runtimeDetails.SERVER_DIR = layout.SERVER_DIR;
        }
        Ui.log(Ui.f`${runtimeDetails}`);
        Ui.log('');
        Ui.log(Ui.f`${'-------------------------------'}`);
        Ui.log('');
        if (processName) {
            Ui.success(`Runtime running in ${Ui.style.keyword('production')}; ${(processAutoRestart ? 'will' : 'wo\'nt')} autorestart on crash!`);
            Ui.info(Ui.f`Process name: ${processName}`);
            Ui.log('');
        }

    };

    if (flags.env !== 'prod' && flags.watch) {
        var nodemon, ecpt;
        try {
            nodemon = await import(Path.resolve('./node_modules/nodemon/lib/nodemon.js'));
        } catch(e) {
            ecpt = e;
        }
        if (nodemon) {
            try {
                nodemon.default({script, ext: 'js json html'});
                showRunning();
                return;
            } catch(e) {
                throw e;
            }
        } else {
            Ui.error('Filesystem watch could not be enabled. ' + ecpt);
        }
    }

    if (flags.env === 'prod') {
        return new Promise(resolve => {
            Pm2.connect(true/* no_daemon_mode */, err => {
                if (err) {
                    Ui.error(err);
                    resolve();
                } else {

                    var name = config.process.name,
                        scriptArgs = ['__cmd__', '__keywords__'].concat(Object.keys(flags).map(f => '--' + f + (flags[f] === true ? '=TRUE' : (flags[f] === false ? '=FALSE' : (flags[f] !== undefined ? '=' + flags[f] : ''))))),
                        exec_mode = config.process.exec_mode || 'fork',
                        autorestart = 'AUTO_RESTART' in config ? config.process.autorestart : true,
                        merge_logs = 'merge_logs' in config.process ? config.process.merge_logs : false,
                        output = config.process.outfile || Path.resolve('./.webqit/webflo/runtime/output.log'),
                        error = config.process.errfile || Path.resolve('./.webqit/webflo/runtime/error.log'),
                        log_date_format = 'YYYY-MM-DD HH:mm Z',
                        watch = flags.watch;
                    const pm2Opts = { name, scriptArgs, watch, exec_mode, autorestart, merge_logs, output, error, log_date_format, force: true};
                    Pm2.start(script, pm2Opts, err => {
                        if (err) {
                            Ui.error(err);
                        } else {
                            Ui.log('');
                            showRunning(name, autorestart);
                        }
                        //Pm2.disconnect(resolve);
                    });
                }
            });
        });    
    }
    await Runtime.call(null, Ui, flags);
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
                Ui.success(Ui.f`Runtime ${flags.kill ? 'killed' : 'stopped'}: ${name}`);
            }
            resolve();
        };
        if (flags.kill) {
            //Pm2.kill(name, cb); API changed
            Pm2.kill(cb);
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
                Ui.success(Ui.f`Runtime restarted: ${name}`);
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
