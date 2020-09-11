
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Clear from 'clear';
import Chalk from 'chalk';
import Figlet from 'figlet';
import Inquirer from 'inquirer';
import _merge from '@onephrase/util/obj/merge.js';
import _isTypeObject from '@onephrase/util/js/isTypeObject.js';
import _isFunction from '@onephrase/util/js/isFunction.js';

/**
 * Obtains parameters for initializing a server.
 * 
 * @param string    root
 * @param object    flags
 * @param bool      ellipsis
 * @param string    version
 * 
 * @return Promise
 */
export default async function(root, flags, ellipsis, version) {
    
    // -------------------
    // Splash screen
    // -------------------
    Clear();
    console.log(Chalk.cyan(
        Figlet.textSync('Navigator', {horizontalLayout: 'full'}) + Chalk.bgGray(Chalk.black(version))
    ));
    // -------------------
    // Create server parameters
    // -------------------
    var params = _merge({
        port: process.env.PORT || flags['p'] || flags['port'] || 4200,
        root,
        appDir: './server',
        publicDir: './public',
        showRequestLog: true,
    }, flags), serverParams;
    // Merge parameters from a JSON file
    if (Fs.existsSync(serverParams = Path.join(root, flags['config'] || './navigator.config.js'))) {
        var params2 = await import('file:///' + serverParams);
        Object.keys(params2 || {}).forEach(k => {
            params[k] = params2[k];
        });
    }
    const validation = {
        port: suffix => {
            return val => val ? true : 'Please provide a valid port number' + suffix;
        },
        appDir: suffix => {
            return val => val ? true : 'Please provide a directory' + suffix;
        },
        publicDir: suffix => {
            return val => val ? true : 'Please provide a directory' + suffix;
        },
        showRequestLog: suffix => {
            return val => [true, false].includes(val) ? true : 'Please select yes/no' + suffix;
        },
    };
    
    if (ellipsis) {
        var questions = [
            {
                name: 'port',
                type: 'number',
                message: 'Enter port number:',
                default: params.port,
                validate: validation.port(':'),
            },
            {
                name: 'appDir',
                type: 'input',
                message: 'Enter the directory for API endpoints:',
                default: params.appDir,
                validate: validation.appDir(':'),
            },
            {
                name: 'publicDir',
                type: 'input',
                message: 'Enter the directory for static files:',
                default: params.publicDir,
                validate: validation.publicDir(':'),
            },
            {
                name: 'showRequestLog',
                type: 'confirm',
                message: 'Choose whether to show request log:',
                default: params.showRequestLog,
                validate: validation.showRequestLog(':'),
            },
        ];
        console.log('');
        console.log(Chalk.whiteBright(`Enter parameters:`));
        _merge(params, await Inquirer.prompt(questions));
    } else {
        // Valiate
        Object.keys(params).forEach(k => {
            var msg;
            if (validation[k] && (msg = validation[k]('!')(params[k])) !== true) {
                console.log('');
                console.log(Chalk.redBright('[' + k + ']: ' + msg));
                console.log(Chalk.redBright('Exiting...'));
                process.exit();
            }
        });
    }
    console.log('');

    // Resolve paths
    ['appDir', 'publicDir'].forEach(name => {
        if (name in params) {
            params[name] = Path.resolve(Path.join(params.root, params[name]));
        }
    });

    console.log(Chalk.whiteBright(`Starting server with the following params:`));
    Object.keys(params).forEach(prop => {
        console.log(Chalk.blueBright('> ') + prop + ': ' + (
            _isFunction(params[prop]) ? '(function)' + params[prop].name : (_isTypeObject(params[prop]) ? '(object)' : Chalk.blueBright(params[prop]))
        ));
    });
    console.log('');

    return params;
};
