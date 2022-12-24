
/**
 * imports
 */
import Url from 'url';
import { _before } from '@webqit/util/str/index.js';
import { _isTypeObject } from '@webqit/util/js/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Origins extends Dotfile {

    // Base name
    get name() {
        return 'origins';
    }

    // @desc
    static get ['@desc']() {
        return 'Remote origins config.';
    }

    // Defaults merger
    withDefaults(config) {
        let hostname = '', origin = '';
        if (this.cx.PKG && this.cx.PKG.repository) {
            var inferredRepo = Url.parse(_isTypeObject(this.cx.PKG.repository) ? this.cx.PKG.repository.url : this.cx.PKG.repository);
            hostname = _before(inferredRepo.hostname, '.');
            origin = _before(inferredRepo.pathname, '.');
        }
        // Params
        return this.merge({
            entries: [{
                host: hostname,
                access_token: '',
                repo: origin,
                branch: 'master',
                tag: 'root',
                deploy_path: '.',
                autodeploy: true,
                autodeploy_secret: '',
                ondeploy: 'npm install',
                ondeploy_autoexit: true,
            }],
        }, config, 'patch');
    }

    // Match
    async match(url) {
        return ((await this.read()).entries || []).filter(_origin => _origin.tag.toLowerCase() === url.toLowerCase() || _origin.repo.toLowerCase() === url.toLowerCase());
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = this.merge({
            host: [
                {value: 'github',},
                {value: 'bitbucket',},
            ],
        }, choices, 'patch');
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'repository',
                },
                initial: config.entries,
                schema: [
                    {
                        name: 'host',
                        type: 'select',
                        message: 'Host name',
                        choices: CHOICES.host,
                        validation: ['input', 'important'],
                    },
                    {
                        name: 'access_token',
                        type: 'text',
                        message: 'Enter your Personal Acess Token at host (if exists)',
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
                        validation: ['important'],
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
                    {
                        name: 'ondeploy_autoexit',
                        type: (prev, ans) => ans.autodeploy ? 'toggle' : null,
                        message: 'Auto exit process on deploy?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                ],
            },

        ];
    }
}
