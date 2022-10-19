
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Virtualization extends Dotfile {

    // Base name
    get name() {
        return 'virtualization';
    }

    // @desc
    static get ['@desc']() {
        return 'Layout virtualization config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = _merge({
            proto: [
                {value: '', title: '(Auto)'},
                {value: 'http', title: 'HTTP'},
                {value: 'https', title: 'HTTPS'},
            ],
        }, choices);
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
