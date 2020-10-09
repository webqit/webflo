
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Clear from 'clear';
import Chalk from 'chalk';
import Figlet from 'figlet';
import _merge from '@onephrase/util/obj/merge.js';
import _isTypeObject from '@onephrase/util/js/isTypeObject.js';
import _isFunction from '@onephrase/util/js/isFunction.js';
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
 * @param object    lib
 * 
 * @return Promise
 */
export default async function(ROOT, flags, ellipsis, pkg, lib) {
    // -------------------
    // Splash screen
    // -------------------
    Clear();
    console.log(Chalk.cyan(
        Figlet.textSync(lib.title, {horizontalLayout: 'full'}) + Chalk.bgGray(Chalk.black(lib.version))
    ));
    // --------------------------------
    var _params = {}, _paramsFile;
    if (Fs.existsSync(_paramsFile = Path.join(ROOT, flags['CONFIG'] || './.navigator/server.config.json'))) {
        _params = DotJson.read(_paramsFile);
    }
    // -------------------
    // Create server parameters
    // -------------------
    var params = _merge({
        PORT: process.env.PORT || 4200,
        ROOT,
        PUBLIC_DIR: './public',
        SERVER_DIR: './server',
        PRODUCTION: false,
        HOST: '127.0.0.1',
        SHOW_REQUEST_LOG: true,
    }, _params, flags);
    
    if (ellipsis) {
        var questions = [
            {
                name: 'PORT',
                type: 'number',
                message: 'Enter PORT number:',
                initial: params.PORT,
                validate: validateAs(['number']),
            },
            {
                name: 'PUBLIC_DIR',
                type: 'text',
                message: 'Enter the application\'s public directory:',
                initial: params.PUBLIC_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input']),
            },
            {
                name: 'SERVER_DIR',
                type: 'text',
                message: 'Enter the application\'s server-side routing directory:',
                initial: params.SERVER_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input']),
            },
            {
                name: 'PRODUCTION',
                type: 'toggle',
                message: 'Keep the server running - in production:',
                active: 'YES',
                inactive: 'NO',
                initial: params.PRODUCTION,
            },
            {
                name: 'HOST',
                type: (prev, answers) => answers.PRODUCTION ? 'text' : null,
                message: 'Enter the production server hostname:',
                initial: params.HOST,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'SHOW_REQUEST_LOG',
                type: 'toggle',
                message: 'Choose whether to show request log:',
                active: 'YES',
                inactive: 'NO',
                initial: params.SHOW_REQUEST_LOG,
            },
        ];

        console.log('');
        console.log(Chalk.whiteBright(`Enter parameters:`));
        _merge(params, await Promptx(questions));
        
    } else {

        console.log('');
        console.log(Chalk.whiteBright(`Starting server with the following params:`));
        printArgs(params);

    }

    if (!flags['CONFIG']) {
        DotJson.write(params, _paramsFile);
    }
    
    return params;
};
