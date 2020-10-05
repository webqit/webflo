#!/usr/bin/env node

/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import _parseArgs from '@onephrase/util/cli/parseArgs.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import createRepoParams from './repo/createParams.js';
import * as Repo from './repo/cmd.js';
import createClientParams from './client/app/createParams.js';
import * as Client from './client/app/cmd.js';
import createPwaParams from './client/pwa/createParams.js';
import * as Pwa from './client/pwa/cmd.js';
import createServerParams from './server/createParams.js';
import * as Server from './server/cmd.js';
import * as Directives from './directives/cmd.js';

// ------------------------------------------

var pkg = DotJson.read('./package.json');

// ------------------------------------------

var commands = {
    'deploy-repo | deploy': Repo.desc.deploy,
    // --------------------------
    'build-client | build': Client.desc.build,
    // --------------------------
    'build-pwa | build': Pwa.desc.build,
    // --------------------------
    'start-server | start': Server.desc.start,
    'stop-server | stop': Server.desc.stop,
    'restart-server | restart': Server.desc.restart,
    'kill-server | kill': Server.desc.kill,
    'list-servers | list': Server.desc.list,
    // --------------------------
    'add-preurl': 'Adds a new URL for pre-rendering.',
    'del-preurl': 'Deletes an URL for pre-rendering.',
    'list-preurls': 'Lists all URLs for pre-rendering.',
    // --------------------------
    'add-env': 'Adds a new ENV variable.',
    'del-env': 'Deletes an ENV variable.',
    'list-envs': 'Lists all ENV variables.',
    // --------------------------
    'add-rdr': 'Adds a new REDIRECT directive.',
    'del-rdr': 'Deletes a REDIRECT directive.',
    'list-rdrs': 'Lists all REDIRECT directives.',
    // --------------------------
    'add-vhost': 'Adds a new VHOST variable.',
    'del-vhost': 'Deletes an VHOST variable.',
    'list-vhosts': 'Lists all VHOST variables.',
};

// ------------------------------------------

const { command, flags, _flags, ellipsis } = _parseArgs(process.argv);

// ------------------------------------------

console.log('');
switch(command) {

    // --------------------------

    case 'deploy-repo':
    case 'deploy':
        createRepoParams(process.cwd(), flags, ellipsis, pkg).then(params => {
            Repo.deploy(params, flags);
        });
    break;

    // --------------------------

    case 'build-client':
    case 'build':
        createClientParams(process.cwd(), flags, ellipsis, pkg).then(params => {
            Client.build(params, flags);
        });
    break;

    // --------------------------

    case 'build-pwa':
        createPwaParams(process.cwd(), flags, ellipsis, pkg).then(params => {
            Pwa.build(params, flags);
        });
    break;

    // --------------------------

    case 'start-server':
    case 'start':
        var lib = DotJson.read(Path.dirname(Url.fileURLToPath(import.meta.url)) + '/package.json');
        createServerParams(process.cwd(), flags, ellipsis, pkg, lib).then(params => {
            Server.start(params, flags);
        });
    break;

    case 'stop-server':
    case 'stop':
        Server.stop(_flags, pkg).then(() => {
            process.exit();
        });
    break;

    case 'restart-server':
    case 'restart':
        Server.restart(_flags, pkg).then(() => {
            process.exit();
        });
    break;

    case 'kill-server':
    case 'kill':
        Server.kill(_flags, pkg).then(() => {
            process.exit();
        });
    break;

    case 'list-servers':
    case 'list':
        Server.list(_flags, pkg).then(() => {
            process.exit();
        });
    break;

    // --------------------------

    case 'add-preurl':
        Directives.add(flags, 'url', 'preurls.json', 'entry');
    break;

    case 'del-preurl':
        Directives.del(_flags, 'url', 'preurls.json', 'entry');
    break;

    case 'list-preurls':
        Directives.list(_flags, 'url', 'preurls.json', 'entry').then(() => {
            process.exit();
        });
    break;

    // --------------------------

    case 'add-env':
        Directives.add(flags, 'env', '.env');
    break;

    case 'del-env':
        Directives.del(_flags, 'env', '.env');
    break;

    case 'list-envs':
        Directives.list(_flags, 'env', '.env').then(() => {
            process.exit();
        });
    break;

    // --------------------------

    case 'add-rdr':
        Directives.add(flags, 'redirect', 'redirects.json', 'directive');
    break;

    case 'del-rdr':
        Directives.del(_flags, 'redirect', 'redirects.json', 'directive');
    break;

    case 'list-rdrs':
        Directives.list(_flags, 'redirect', 'redirects.json', 'directive').then(() => {
            process.exit();
        });
    break;

    // --------------------------

    case 'add-vhost':
        Directives.add(flags, 'vhost', 'vhosts.json', 'entry');
    break;

    case 'del-vhost':
        Directives.del(_flags, 'vhost', 'vhosts.json', 'entry');
    break;

    case 'list-vhosts':
        Directives.list(_flags, 'vhost', 'vhosts.json', 'entry').then(() => {
            process.exit();
        });
    break;

    // --------------------------

    case 'help':
    default:
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