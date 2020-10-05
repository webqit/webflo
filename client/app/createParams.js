
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Chalk from 'chalk';
import _merge from '@onephrase/util/obj/merge.js';
import Promptx, { validateAs, transformAs } from '@onephrase/util/cli/Promptx.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import printArgs from '@onephrase/util/cli/printArgs.js';

/**
 * Obtains parameters for initializing a server.
 * 
 * @param string    ROOT
 * @param object    flags
 * @param bool      ellipsis
 * @param object    pkg
 * 
 * @return Promise
 */
export default async function(ROOT, flags, ellipsis, pkg) {
    var _params = {}, _paramsFile;
    if (Fs.existsSync(_paramsFile = Path.join(ROOT, flags['CONFIG'] || './.navigator/client.config.json'))) {
        _params = DotJson.read(_paramsFile);
    }
    // -------------------
    // Create server parameters
    // -------------------
    var params = _merge({
        ROOT,
        PUBLIC_DIR: './public',
        CLIENT_DIR: './client',
        CLIENT_HOST_PATH: '',
    }, _params, flags);

    const validation = {
        PUBLIC_DIR: suffix => {
            return val => val ? true : 'Please specify a directory' + suffix;
        },
        CLIENT_DIR: suffix => {
            return val => val ? true : 'Please specify a directory' + suffix;
        },
        CLIENT_HOST_PATH: suffix => {
            return val => true;
        },
    };
    
    if (ellipsis) {
        var questions = [
            {
                name: 'PUBLIC_DIR',
                type: 'text',
                message: 'Enter the application\'s public directory:',
                initial: params.PUBLIC_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'CLIENT_DIR',
                type: 'text',
                message: 'Enter the application\'s client-side routing directory:',
                initial: params.CLIENT_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input', 'important']),
            },
            // ------------- advanced --------------
            {
                name: '__advanced',
                type: 'toggle',
                message: 'Show advanced options?',
                active: 'YES',
                inactive: 'NO',
            },
            // ------------- advanced --------------
            {
                name: 'CLIENT_HOST_PATH',
                type: (rev, answers) => answers.__advanced ? 'text' : null,
                message: 'Enter the application\'s host path (in a multi-host setup):',
                initial: params.CLIENT_HOST_PATH,
                validate: validateAs(['input']),
            },
        ];

        console.log('');
        console.log(Chalk.whiteBright(`Enter parameters:`));
        _merge(params, await Promptx(questions));

    } else {

        console.log('');
        console.log(Chalk.whiteBright(`Creating a build with the following params:`));
        printArgs(params);

    }

    if (!flags['CONFIG']) {
        DotJson.write(params, _paramsFile);
    }

    return params;
};
