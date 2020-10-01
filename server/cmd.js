
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import Pm2 from 'pm2';
import * as DotJson from '../util/DotJson.js';
import Serve from './modules/Server.js';

/**
 * ----------
 * Starts a server (optionally as a pm2 instance)
 * ----------
 */
export function start(params, flags) {
    if (!flags.production && !flags.prod) {
        console.log(Chalk.greenBright('Server running!'));
        console.log('');
        Serve(params);
    } else {
        Pm2.connect(err => {
            if (err) {
                console.log(Chalk.redBright(err));
            } else {

                var paramsFile = Path.resolve('./.process/params.json');
                DotJson.write(params, paramsFile);
                var script = Path.resolve(Path.dirname(Url.fileURLToPath(import.meta.url)), './pm2starter.js'),
                    args = paramsFile,
                    name = flags.name || Path.basename(process.cwd()),
                    autorestart = 'autorestart' in flags ? flags.autorestart === '1' : true,
                    merge_logs = 'merge_logs' in flags ? flags.merge_logs === '1' : true,
                    output = Path.resolve('./.process/output.log'),
                    error = Path.resolve('./.process/error.log');
                Pm2.start({script, name, args, autorestart, merge_logs, output, error, force: true}, err => {
                    if (err) {
                        console.log(Chalk.redBright(err));
                    } else {
                        console.log(Chalk.greenBright('Server running forever; ' + (autorestart ? 'will' : 'wo\'nt') + ' autorestart!'));
                        console.log(Chalk.greenBright('> Process name: ' + Chalk.bold(name)));
                        console.log(Chalk.greenBright('> Stop anytime: `' + Chalk.bold('nav stop-server ' + name) + '`'));
                    }
                    Pm2.disconnect(() => {});
                });
            }
        });        
    }
};

/**
 * ----------
 * Stops a pm2 instance
 * ----------
 */
export function stop(_flags) {
    var name = _flags[0] || Path.basename(process.cwd());
    Pm2.stop(name, err => {
        if (err) {
            console.log(Chalk.redBright(err));
        } else {
            console.log('');
            console.log(Chalk.yellowBright('Server stopped: ' + Chalk.bold(name)));
        }
        process.exit();
    });
};

/**
 * ----------
 * Restarts a pm2 instance
 * ----------
 */
export function restart(_flags) {
    var name = _flags[0] || Path.basename(process.cwd());
    Pm2.restart(name, err => {
        if (err) {
            console.log(Chalk.redBright(err));
        } else {
            console.log('');
            console.log(Chalk.yellowBright('Server restarted: ' + Chalk.bold(name)));
        }
        process.exit();
    });
};

/**
 * ----------
 * Kills a pm2 instance
 * ----------
 */
export function kill(_flags) {
    var name = _flags[0] || Path.basename(process.cwd());
    Pm2.delete(name, err => {
        if (err) {
            console.log(Chalk.redBright(err));
        } else {
            console.log('');
            console.log(Chalk.yellowBright('Server killed: ' + Chalk.bold(name)));
        }
        process.exit();
    });
};

/**
 * ----------
 * Lists pm2 instances
 * ----------
 */
export function list(_flags) {
    var name = _flags[0] || Path.basename(process.cwd());
    Pm2.list((err, list) => {
        if (err) {
            console.log(Chalk.redBright(err));
        } else {
            console.log('');
            console.log(Chalk.yellowBright('Servers list:'));
            console.log(list.map(p => p.name + ' (' + p.pm2_env.status + ')'));
        }
        process.exit();
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