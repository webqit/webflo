import { Dotfile } from '@webqit/backpack';

export default class Proxy extends Dotfile {

    // Base name
    get name() {
        return 'proxy';
    }

    // @desc
    static get ['@desc']() {
        return 'Layout proxy config.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            entries: [],
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = this.merge({
            proto: [
                {value: '', title: '(Auto)'},
                {value: 'http', title: 'HTTP'},
                {value: 'https', title: 'HTTPS'},
            ],
        }, choices, 'patch');
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'vhost',
                },
                initial: config.entries,
                schema: [
                    {
                        name: 'path',
                        type: 'text',
                        message: '[path]: Enter local pathname to target server if exists.' + "\r\n" + '(Leave empty to explicitly specify hostnames and port number.)' + "\r\n",
                    },
                    {
                        name: 'hostnames',
                        type: 'list',
                        message: '[hostnames]: Enter host names.' + "\r\n" + '(Leave empty to automatically derive hostnames from the config of the target server specified above.)' + "\r\n",
                    },
                    {
                        name: 'port',
                        type: 'number',
                        message: '[port]: Enter the target port number.' + "\r\n" + '(Leave empty to automatically derive target port number from the config of the target server specified above.)' + "\r\n",
                    },
                    {
                        name: 'proto',
                        type: 'select',
                        message: '[protocol]: Enter the target protocol: https/http.' + "\r\n" + '(Leave empty to automatically derive target protocol from the config of the target server specified above.)' + "\r\n",
                        choices: CHOICES.proto,
                        initial: this.indexOfInitial(CHOICES.proto, config.proto),
                        validation: ['important'],
                    },
                ],
            },
    
        ];
    }
}
