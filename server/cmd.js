
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Pm2 from 'pm2';
import Chalk from 'chalk';
import _promise from '@onephrase/util/js/promise.js';
import Promptx from '@onephrase/util/cli/Promptx.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import Serve from './modules/Server.js';

/**
 * ----------
 * Starts a server (optionally as a pm2 instance)
 * ----------
 */
export async function start(params, flags) {
    if (!params.PRODUCTION && !params.PROD && !flags.PRODUCTION && !flags.PROD) {
        console.log('');
        console.log(Chalk.greenBright('> Server running!'));
        await Serve(params);
    } else {
        await _promise(resolve => {
            Pm2.connect(err => {
                if (err) {
                    console.log(Chalk.redBright(err));
                    resolve();
                } else {

                    var paramsFile = Path.resolve('./.process/params.json');
                    DotJson.write(params, paramsFile);
                    var script = Path.resolve(Path.dirname(Url.fileURLToPath(import.meta.url)), './pm2starter.js'),
                        args = paramsFile,
                        name = flags.NAME || Path.basename(process.cwd()),
                        autorestart = 'AUTO_RESTART' in flags ? flags.AUTO_RESTART === '1' : true,
                        merge_logs = 'MERGE_LOGS' in flags ? flags.MERGE_LOGS === '1' : true,
                        output = Path.resolve('./.process/output.log'),
                        error = Path.resolve('./.process/error.log');
                    Pm2.start({script, name, args, autorestart, merge_logs, output, error, force: true}, err => {
                        if (err) {
                            console.log(Chalk.redBright(err));
                        } else {
                            console.log('');
                            console.log(Chalk.greenBright('> Server running forever; ' + (autorestart ? 'will' : 'wo\'nt') + ' autorestart!'));
                            console.log(Chalk.greenBright('> Process name: ' + Chalk.bold(name)));
                            console.log(Chalk.greenBright('> Stop anytime: `' + Chalk.bold('nav stop-server ' + name) + '`'));
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
export async function stop(_flags, pkg) {
    var name = _flags[0] || pkg.title || Path.basename(process.cwd());
    await _promise(resolve => {
        Pm2.stop(name, err => {
            if (err) {
                console.log(Chalk.redBright(err));
            } else {
                console.log(Chalk.greenBright('> Server stopped: ' + name));
            }
            resolve();
        });
    });
};

/**
 * ----------
 * Restarts a pm2 instance
 * ----------
 */
export async function restart(_flags, pkg) {
    var name = _flags[0] || pkg.title || Path.basename(process.cwd());
    await _promise(resolve => {
        Pm2.restart(name, err => {
            if (err) {
                console.log(Chalk.redBright(err));
            } else {
                console.log(Chalk.greenBright('> Server restarted: ' + name));
            }
            resolve();
        });
    });
};

/**
 * ----------
 * Kills a pm2 instance
 * ----------
 */
export async function kill(_flags, pkg) {
    var name = _flags[0] || pkg.title || Path.basename(process.cwd());
    await _promise(resolve => {
        Pm2.delete(name, err => {
            if (err) {
                console.log(Chalk.redBright(err));
            } else {
                console.log(Chalk.greenBright('> Server killed: ' + name));
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
export async function list(_flags, pkg) {

    var name = pkg.title || Path.basename(process.cwd());
    await _promise(resolve => {
        Pm2.list(async (err, list) => {
            if (err) {

                console.log(Chalk.redBright(err));

            } else {

                var action;
                if (_flags[0] === '--s' || _flags[0] === '--stop') {
                    action = 'stop';
                } else if (_flags[0] === '--r' || _flags[0] === '--restart') {
                    action = 'restart';
                } else if (_flags[0] === '--k' || _flags[0] === '--kill') {
                    action = 'kill';
                }

                list = list.map(p => {
                    p.value = p.name;
                    p.title = p.name + ' (' + p.pm2_env.status + ')';
                    p.disabled = (p.pm2_env.status === 'stopped' && action === 'stop') || (p.pm2_env.status === 'online' && action === 'restart');
                    return p;
                });

                console.log(Chalk.yellowBright('Servers list:' + (!list.length ? ' (empty)' : '')));
                if (!action) {

                    list.forEach(s => console.log('> ' + Chalk[s.pm2_env.status === 'online' ? 'greenBright' : (s.pm2_env.status === 'errorred' ? 'redBright' : 'yellow')](s.title)));

                } else {

                    await Promptx([{
                        name: 'selection',
                        type: 'multiselect',
                        message: 'Select servers to ' + action,
                        choices: list,
                    }, {
                        name: 'confirmation',
                        type: prev => prev.length ? 'toggle' : null,
                        message: action.substr(0,1).toUpperCase() + action.substr(1) + ' selected servers?',
                        active: 'YES',
                        inactive: 'NO',
                    }]).then(answers => {

                        console.log('');
                        return !answers.confirmation ? null : Promise.all(answers.selection.map(name => {
                            if (action === 'stop') {
                                return stop([name], pkg);
                            } else if (action === 'restart') {
                                return restart([name], pkg);
                            } else if (action === 'kill') {
                                return kill([name], pkg);
                            }
                        }));

                    });

                }
            }

            resolve();
        });
    });
};

/**
 * @description
 */
export const desc = {
    start: 'Starts the Navigator server. (--production or --prod to serve in production.)',
    stop: 'Stops a Navigator server.',
    restart: 'Restarts a Navigator server that has been stopped.',
    kill: 'Kills a Navigator server.',
    list: 'Lists all active Navigator servers.',
};