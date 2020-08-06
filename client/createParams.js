
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import _merge from '@web-native-js/commons/obj/merge.js';
import _isTypeObject from '@web-native-js/commons/js/isTypeObject.js';
import _isFunction from '@web-native-js/commons/js/isFunction.js';

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
    // Create server parameters
    // -------------------
    var params = {
        root,
        appDir: './client',
        publicDir: './public',
    }, serverParams;
    // Merge parameters from a JSON file
    if (Fs.existsSync(serverParams = Path.join(root, flags['config'] || './navigator.config.js'))) {
        var params2 = await import('file:///' + serverParams);
        Object.keys(params2 || {}).forEach(k => {
            params[k] = params2[k];
        });
    }
    const validation = {
        appDir: suffix => {
            return val => val ? true : 'Please provide a directory' + suffix;
        },
        publicDir: suffix => {
            return val => val ? true : 'Please provide a directory' + suffix;
        },
    };
    
    if (ellipsis) {
        var questions = [
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
        ];
        console.log('');
        console.log(chalk.whiteBright(`Enter parameters:`));
        _merge(params, await inquirer.prompt(questions));
    } else {
        // Valiate
        Object.keys(params).forEach(k => {
            var msg;
            if (validation[k] && (msg = validation[k]('!')(params[k])) !== true) {
                console.log('');
                console.log(chalk.red('[' + k + ']: ' + msg));
                console.log(chalk.red('Exiting...'));
                process.exit();
            }
        });
    }

    // Resolve paths
    ['appDir', 'publicDir'].forEach(name => {
        if (name in params) {
            params[name] = Path.resolve(Path.join(params.root, params[name]));
        }
    });

    console.log('');
    console.log(chalk.whiteBright(`Creating a build with the following params:`));
    Object.keys(params).forEach(prop => {
        console.log(chalk.blueBright('> ') + prop + ': ' + (
            _isFunction(params[prop]) ? '(function)' + params[prop].name : (_isTypeObject(params[prop]) ? '(object)' : chalk.blueBright(params[prop]))
        ));
    });

    return params;
};
