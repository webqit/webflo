
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _before from '@webqit/util/str/before.js';
import _isTypeObject from '@webqit/util/js/isTypeObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads REPOS from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    const config = DotJson.read(Path.join(params.ROOT || '', './.webflo/config/repos.json'));
    
    var hostname = '', repo = '';
    if (params.PKG && params.PKG.repository) {
        var inferredRepo = Url.parse(_isTypeObject(params.PKG.repository) ? params.PKG.repository.url : params.PKG.repository);
        hostname = _before(inferredRepo.hostname, '.');
        repo = _before(inferredRepo.pathname, '.');
    }

    // Params
    return _merge({
        REPOS: [{
            HOST: hostname,
            REPO: repo,
            BRANCH: 'master',
            TAG: 'origin',
            DEPLOY_PATH: '.',
        }],
    }, config);

};

/**
 * Writes REPOS to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/repos.json'));
};

/**
 * @match
 */
export async function match(repo, params = {}) {
    return ((await read(params)).REPOS || []).filter(_repo => _repo.TAG.toLowerCase() === repo.toLowerCase() || _repo.REPO.toLowerCase() === repo.toLowerCase());
};

/**
 * Configures REPOS.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Choices
    const CHOICES = _merge({
        host: [
            {value: 'github',},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'REPOS',
            type: 'recursive',
            controls: {
                name: 'repository',
            },
            initial: config.REPOS,
            questions: [
                {
                    name: 'HOST',
                    type: 'select',
                    message: 'Host name',
                    choices: CHOICES.host,
                    validation: ['input', 'important'],
                },
                {
                    name: 'REPO',
                    type: 'text',
                    message: 'Enter a repository name (in the format: user-or-org/repo)',
                    validation: ['input', 'important'],
                },
                {
                    name: 'BRANCH',
                    type: 'text',
                    message: 'Specifiy the git branch within the given repository',
                    validation: ['input', 'important'],
                },
                {
                    name: 'TAG',
                    type: 'text',
                    message: 'Enter a local name for this repo',
                    validation: ['input', 'important'],
                },
                {
                    name: 'DEPLOY_PATH',
                    type: 'text',
                    message: 'Enter the relative local path that this repo deploys to',
                    validation: ['path-relative'],
                },
                {
                    name: 'AUTO_DEPLOY',
                    type: 'toggle',
                    message: 'Auto-deploy this repo on every push to branch?',
                    active: 'YES',
                    inactive: 'NO',
                },
                {
                    name: 'AUTO_DEPLOY_SECRET',
                    type: (prev, ans) => ans.AUTO_DEPLOY ? 'text' : null,
                    message: 'Enter the "secret" for validating the auto-deploy webhook event',
                    validation: ['input', 'important'],
                },
            ],
        },

    ];
};
