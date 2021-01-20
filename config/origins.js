
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
 * Reads entries from file.
 * 
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    const config = DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/origins.json'));
    
    var hostname = '', origin = '';
    if (setup.PKG && setup.PKG.repository) {
        var inferredRepo = Url.parse(_isTypeObject(setup.PKG.repository) ? setup.PKG.repository.url : setup.PKG.repository);
        hostname = _before(inferredRepo.hostname, '.');
        origin = _before(inferredRepo.pathname, '.');
    }

    // Params
    return _merge({
        entries: [{
            host: hostname,
            repo: origin,
            branch: 'master',
            tag: 'origin',
            deploy_path: '.',
            autodeploy: true,
            autodeploy_secret: '',
            ondeploy: '',
        }],
    }, config);

};

/**
 * Writes entries to file.
 * 
 * @param object    config
 * @param object    setup
 * 
 * @return void
 */
export async function write(config, setup = {}) {
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/origins.json'));
};

/**
 * @match
 */
export async function match(origin, setup = {}) {
    return ((await read(setup)).entries || []).filter(_origin => _origin.tag.toLowerCase() === origin.toLowerCase() || _origin.repo.toLowerCase() === origin.toLowerCase());
};

/**
 * Configures entries.
 * 
 * @param object    config
 * @param object    choices
 * @param object    setup
 * 
 * @return Array
 */
export async function questions(config, choices = {}, setup = {}) {

    // Choices
    const CHOICES = _merge({
        host: [
            {value: 'github',},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'entries',
            type: 'recursive',
            controls: {
                name: 'repository',
            },
            initial: config.entries,
            questions: [
                {
                    name: 'host',
                    type: 'select',
                    message: 'Host name',
                    choices: CHOICES.host,
                    validation: ['input', 'important'],
                },
                {
                    name: 'repo',
                    type: 'text',
                    message: 'Enter a repository name (in the format: user-or-org/origin)',
                    validation: ['input', 'important'],
                },
                {
                    name: 'branch',
                    type: 'text',
                    message: 'Specifiy the git branch within the given repository',
                    validation: ['input', 'important'],
                },
                {
                    name: 'tag',
                    type: 'text',
                    message: 'Enter a local name for this origin',
                    validation: ['input', 'important'],
                },
                {
                    name: 'deploy_path',
                    type: 'text',
                    message: 'Enter the relative local path that this origin deploys to',
                    validation: ['path-relative'],
                },
                {
                    name: 'autodeploy',
                    type: 'toggle',
                    message: 'Auto-deploy this origin on every push to branch?',
                    active: 'YES',
                    inactive: 'NO',
                },
                {
                    name: 'autodeploy_secret',
                    type: (prev, ans) => ans.autodeploy ? 'text' : null,
                    message: 'Enter the "secret" for validating the auto-deploy webhook event',
                    validation: ['input', 'important'],
                },
                {
                    name: 'ondeploy',
                    type: 'text',
                    message: 'Enter an optional "command" to run on deploy',
                    validation: ['input', 'important'],
                },
            ],
        },

    ];
};
