#!/usr/bin/env node

/**
 * imports
 */
import Chalk from 'chalk';
import _arrLast from '@onephrase/util/arr/last.js';
import _arrFrom from '@onephrase/util/arr/from.js';
import * as Repo from './repo/cmd.js';
import createRepoParams from './repo/createParams.js';
import * as Client from './client/cmd.js';
import createClientParams from './client/createParams.js';
import * as Server from './server/cmd.js';
import createServerParams from './server/createParams.js';
import * as Directives from './directives/cmd.js';

// Version
var version = 'v0.0.1';

// Commands list
var commands = {
    'deploy-repo | deploy': Repo.desc.deploy,
    // --------------------------
    'build-client | build': Client.desc.build,
    // --------------------------
    'start-server | start': Server.desc.start,
    'stop-server | stop': Server.desc.stop,
    'restart-server | restart': Server.desc.restart,
    'kill-server | kill': Server.desc.kill,
    'list-servers | list': Server.desc.list,
    // --------------------------
    'add-env': 'Adds a new ENV variable.',
    'del-env': 'Deletes an ENV variable.',
    'list-envs': 'Lists all ENV variables.',
    // --------------------------
    'add-cname': 'Adds a new CNAME variable.',
    'del-cname': 'Deletes an CNAME variable.',
    'list-cnames': 'Lists all CNAME variables.',
    // --------------------------
    'add-redirect': 'Adds a new REDIRECT directive.',
    'del-redirect': 'Deletes a REDIRECT directive.',
    'list-redirects': 'Lists all REDIRECT directives.',
};

// Mine parameters

// ------------------------------------------

var command = process.argv[2], _flags = process.argv.slice(3), flags = {}, ellipsis;
if (_arrLast(_flags) === '...') {
    _flags.pop();
    ellipsis = true;
}
_flags.forEach(flag => {
    if (flag.indexOf('+=') > -1 || flag.indexOf('=') > -1 || flag.startsWith('#')) {
        if (flag.indexOf('+=') > -1) {
            flag = flag.split('+=');
            flags[flag[0]] = _arrFrom(flags[flag[0]]);
            flags[flag[0]].push(flag[1]);
        } else {
            flag = flag.split('=');
            flags[flag[0]] = flag[1];
        }
    } else if (flag.startsWith('--')) {
        flags[flag.substr(2)] = true;
    }
});

// ------------------------------------------

// Exec
switch(command) {

    // --------------------------

    case 'deploy-repo':
    case 'deploy':
        createRepoParams(process.cwd(), flags, ellipsis, version).then(params => {
            Repo.deploy(params, flags);
        });
    break;

    // --------------------------

    case 'build-client':
    case 'build':
        createClientParams(process.cwd(), flags, ellipsis, version).then(params => {
            Client.build(params, flags);
        });
    break;

    // --------------------------

    case 'start-server':
    case 'start':
        createServerParams(process.cwd(), flags, ellipsis, version).then(params => {
            Server.start(params, flags);
        });
    break;

    case 'stop-server':
    case 'stop':
        Server.stop(_flags);
    break;

    case 'restart-server':
    case 'restart':
        Server.restart(_flags);
    break;

    case 'kill-server':
    case 'kill':
        Server.kill(_flags);
    break;

    case 'list-servers':
    case 'list':
        Server.list(_flags);
    break;

    // --------------------------

    case 'add-env':
        Directives.add(flags, 'env', '.env');
    break;

    case 'del-env':
        Directives.del(_flags, 'env', '.env');
    break;

    case 'list-envs':
        Directives.list('env', '.env');
    break;

    // --------------------------

    case 'add-cname':
        Directives.add(flags, 'cname', 'cnames.json', 'directive');
    break;

    case 'del-cname':
        Directives.del(_flags, 'cname', 'cnames.json', 'directive');
    break;

    case 'list-cnames':
        Directives.list('cname', 'cnames.json', 'directive');
    break;

    // --------------------------

    case 'add-redirect':
        Directives.add(flags, 'redirect', 'redirects.json', 'directive');
    break;

    case 'del-redirect':
        Directives.del(_flags, 'redirect', 'redirects.json', 'directive');
    break;

    case 'list-redirects':
        Directives.list('redirect', 'redirects.json', 'directive');
    break;

    // --------------------------

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