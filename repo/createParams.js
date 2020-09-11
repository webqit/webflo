
/**
 * imports
 */
import Path from 'path';
import Chalk from 'chalk';
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
    // Create server parameters
    // -------------------
    var hosts = ['github'];
    var params = _merge({
        root,
        host: 'github',
        account: '',
        repo: Path.basename(root),
        branch: 'master',
        name: 'origin',
    }, flags);
    const validation = {
        host: suffix => {
            return val => hosts.includes(val) ? true : 'Please provide a recognized host' + suffix;
        },
        account: suffix => {
            return val => val ? true : 'Please enter your account name at host' + suffix;
        },
        repo: suffix => {
            return val => val ? true : 'Please enter repo name at host' + suffix;
        },
        branch: suffix => {
            return val => val ? true : 'Please enter branch at repo' + suffix;
        },
        name: suffix => {
            return val => val ? true : 'Please enter a local name for the remote repo' + suffix;
        },
    };
    
    if (ellipsis) {
        var questions = [
            {
                name: 'host',
                type: 'input',
                message: 'Host name:',
                default: params.host,
                validate: validation.host(':'),
            },
            {
                name: 'account',
                type: 'input',
                message: 'Account name at host:',
                default: params.account,
                validate: validation.account(':'),
            },
            {
                name: 'repo',
                type: 'input',
                message: 'Repo name at host:',
                default: params.repo,
                validate: validation.repo(':'),
            },
            {
                name: 'branch',
                type: 'input',
                message: 'Branch name at repo:',
                default: params.branch,
                validate: validation.branch(':'),
            },
            {
                name: 'name',
                type: 'input',
                message: 'A local name for the remote repo:',
                default: params.name,
                validate: validation.name(':'),
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
    console.log(Chalk.whiteBright(`Initiating deploy with the following params:`));
    Object.keys(params).forEach(prop => {
        console.log(Chalk.blueBright('> ') + prop + ': ' + (
            _isFunction(params[prop]) ? '(function)' + params[prop].name : (_isTypeObject(params[prop]) ? '(object)' : Chalk.blueBright(params[prop]))
        ));
    });

    return params;
};
