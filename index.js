#!/usr/bin/env node

/**
 * imports
 */
import Fs from 'fs';
import Pm2 from 'pm2'; // Have had to modify: node_modules\pm2\lib\ProcessContainerFork.js
import Chalk from 'chalk';
import Path from 'path';
import _arrLast from '@web-native-js/commons/arr/last.js';
import { createParams as createDeployParams, execDeploy } from './repo/index.js';
import { createParams as createBuildParams, execBuild } from './client/index.js';
import { createParams as createServerParams, execStart } from './server/index.js';

// Commands list
var version = 'v0.0.1';
var commands = {
    'enter-dir': 'Enters a directory; creates it if not exists.',
    'repo deploy | deploy': 'Deploys a remote repo into the current working directory.',
    'client build | build': 'Builds the Navigator client.',
    'server start | serve': 'Starts a Navigator server.',
    'server stop | unserve': 'Stops a Navigator server.',
    'server restart': 'Restarts a Navigator server that has been stopped.',
    'server kill': 'Kills a Navigator server.',
    'server list': 'Lists all active Navigator servers.',
};

// Mine parameters
var command = process.argv[2], _flags = process.argv.slice(3), flags = {}, ellipsis;
if (['repo', 'client', 'server'].includes(command)) {
    command += ' ' + _flags.shift();
}
if (_arrLast(_flags) === '...') {
    _flags.pop();
    ellipsis = true;
}
_flags.forEach(flag => {
    if (flag.indexOf('=') > -1) {
        flag = flag.split('=');
        flags[flag[0]] = flag[1];
    } else if (flag.startsWith('--')) {
        flags[flag.substr(2)] = true;
    }
});

// Exec
switch(command) {

    case 'enter-dir':
        if (!_flags[0]) {
            console.log(Chalk.yellowBright('Please enter a directory name!'));
        } else {
            if (!Fs.existsSync(_flags[0])) {
                Fs.mkdirSync(_flags[0], {recursive:true});
            } else {
                console.log(Chalk.blueBright('Existing directory!'));
            }
            process.chdir('./' + _flags[0]);
            console.log(Chalk.blueBright('New working directory: ') + Chalk.greenBright(process.cwd()));
        }
    break;

    case 'repo deploy':
    case 'deploy':
        createDeployParams(process.cwd(), flags, ellipsis, version).then(params => {
            execDeploy(params);
        });
    break;

    case 'client build':
    case 'build':
            createBuildParams(process.cwd(), flags, ellipsis, version).then(params => {
            execBuild(params);
        });
    break;

    case 'server start':
    case 'serve':
        createServerParams(process.cwd(), flags, ellipsis, version).then(params => {
            if (!flags.forever) {
                console.log(Chalk.greenBright('Server running!'));
                console.log('');
                execStart(params);
            } else {
                Pm2.connect(err => {
                    if (err) {
                        console.log(Chalk.redBright(err));
                    } else {
                        var paramsFile = Path.resolve('./.process/params.json');
                        Fs.mkdirSync(Path.dirname(paramsFile), {recursive:true});
                        Fs.writeFileSync(paramsFile, JSON.stringify(params));
                        var script = Path.resolve(Path.dirname(import.meta.url.replace('file:///', '')), './server/pm2starter.js'),
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
                                console.log(Chalk.greenBright('> Stop anytime: ' + Chalk.bold('nav unserve ' + name)));
                            }
                            Pm2.disconnect(() => {});
                        });
                    }
                });        
            }
        });
    break;

    case 'server stop':
    case 'unserve':
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
    break;

    case 'server restart':
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
    break;

    case 'server kill':
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
    break;

    case 'server list':
        var name = _flags[0] || Path.basename(process.cwd());
        Pm2.list((err, list) => {
            if (err) {
                console.log(Chalk.redBright(err));
            } else {
                console.log('');
                console.log(Chalk.yellowBright('Server list:'));
                console.log(list.map(p => p.name + ' (' + p.pm2_env.status + ')'));
            }
            process.exit();
        });
    break;

    case 'help':
    default:
        console.log('');
        console.log(Chalk.bgYellowBright(Chalk.black(' NAVIGATOR HELP ')));
        console.log('');
        console.log('Say ' + Chalk.bold(Chalk.yellowBright('nav')) + ' <command> <args>');
        console.log('');
        console.log('Where <command> is one of:');
        Object.keys(commands).forEach(name => {
            console.log('   ' + Chalk.bold(Chalk.yellowBright(name)) + ': ' + commands[name]);
        });
        console.log('');
        console.log('Where <args> is zero or more arguments. (Use an ellipsis [' + Chalk.bold(Chalk.yellowBright('...')) + '] for a walkthrough.)');
        console.log('');
        console.log('Example: ' + Chalk.bold(Chalk.yellowBright('nav serve ...')));
}