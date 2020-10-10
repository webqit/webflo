
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import _merge from '@onephrase/util/obj/merge.js';
import _before from '@onephrase/util/str/before.js';
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
 * 
 * @return Promise
 */
export default async function(ROOT, flags, ellipsis, pkg) {
    var _params = {}, _paramsFile;
    if (Fs.existsSync(_paramsFile = Path.join(ROOT, flags['CONFIG'] || './.webflo/config/deploy.json'))) {
        _params = DotJson.read(_paramsFile);
    }
    // -------------------
    // Create server parameters
    // -------------------
    var hostname = '', account = '', repo = '';
    if (pkg.repository) {
        var inferredRepo = Url.parse(_isTypeObject(pkg.repository) ? pkg.repository.url : pkg.repository);
        hostname = _before(inferredRepo.hostname, '.');
        var pathname = inferredRepo.pathname.split('/').filter(a => a);
        account = pathname[0];
        repo = _before(pathname[1], '.');
    }
    var HOSTs = ['github'];
    var params = _merge({
        ROOT,
        HOST: hostname,
        ACCOUNT: account,
        REPO: repo,
        BRANCH: 'master',
        NAME: 'origin',
    }, _params, flags);
    
    if (ellipsis) {
        var questions = [
            {
                name: 'HOST',
                type: 'text',
                message: 'Host name:',
                initial: params.HOST,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'ACCOUNT',
                type: 'text',
                message: prev => 'Enter a ' + prev + ' username:',
                initial: params.ACCOUNT,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'REPO',
                type: 'text',
                message: prev => 'Specifiy a repository within ' + prev + ':',
                initial: params.REPO,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'BRANCH',
                type: 'text',
                message: prev => 'Specifiy the git branch within ' + prev + ':',
                initial: params.BRANCH,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'NAME',
                type: 'text',
                message: 'Specifiy a local name for the remote REPO:',
                initial: params.NAME,
                validate: validateAs(['input', 'important']),
            },
        ];

        console.log('');
        console.log(Chalk.whiteBright(`Enter parameters:`));
        _merge(params, await Promptx(questions));

    } else {

        console.log('');
        console.log(Chalk.whiteBright(`Deploying with the following params:`));
        printArgs(params);
    }

    if (!flags['CONFIG']) {
        DotJson.write(params, _paramsFile);
    }

    return params;
};
