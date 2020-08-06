#!/usr/bin/env node

/**
 * imports
 */
import _arrLast from '@web-native-js/commons/arr/last.js';
import createBuildParams from './client/createParams.js';
import createBuild from './client/createBuild.js';
import createServerParams from './server/createParams.js';
import createServer from './server/createServer.js';
import chalk from 'chalk';

// Commands list
var version = 'v0.0.1';
var commands = {
    build: 'Builds the Navigator client.',
    serve: 'Starts the Navigator server.',
};

// Mine parameters
var command = process.argv[2], _flags = process.argv.slice(3), flags = {}, ellipsis;
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

    case 'build':
        createBuildParams(process.cwd(), flags, ellipsis, version).then(params => {
            createBuild(params);
        });
    break;

    case 'serve':
        createServerParams(process.cwd(), flags, ellipsis, version).then(params => {
            createServer(params);
        });
    break;
    
    case 'help':
    default:
        console.log('');
        console.log(chalk.bgYellow(chalk.black(' NAVIGATOR HELP ')));
        console.log('');
        console.log('Say ' + chalk.bold(chalk.yellow('nav')) + ' <command> <args>');
        console.log('');
        console.log('Where <command> is one of:');
        Object.keys(commands).forEach(name => {
            console.log('   ' + chalk.bold(chalk.yellow(name)) + ': ' + commands[name]);
        });
        console.log('');
        console.log('Where <args> is zero or more arguments. (Use an ellipsis [' + chalk.bold(chalk.yellow('...')) + '] for a walkthrough.)');
        console.log('');
        console.log('Example: ' + chalk.bold(chalk.yellow('nav serve ...')));
}