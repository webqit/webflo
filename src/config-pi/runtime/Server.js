
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import Configurator from '../../Configurator.js';

export default class Server extends Configurator {

    // Base name
    get name() {
        return 'server';
    }

    // @desc
    static get ['@desc']() {
        return 'Server Runtime config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            port: process.env.port || 3000,
            https: {
                port: 0,
                keyfile: '',
                certfile: '',
                certdoms: ['*'],
                force: false,
            },
            force_www: '',
            shared: false,
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Choices
        const CHOICES = _merge({
            force_www: [
                {value: '', title: 'do nothing'},
                {value: 'add',},
                {value: 'remove',},
            ],
        }, choices);
        // Questions
        return [
            {
                name: 'port',
                type: 'number',
                message: 'Enter port number',
                initial: config.port,
                validation: ['important'],
            },
            {
                name: 'https',
                controls: {
                    name: 'https',
                },
                initial: config.https,
                questions: [
                    {
                        name: 'port',
                        type: 'number',
                        message: 'Enter HTTPS port number',
                        validation: ['important'],
                    },
                    {
                        name: 'keyfile',
                        type: 'text',
                        message: 'Enter SSL KEY file',
                        validation: ['important'],
                    },
                    {
                        name: 'certfile',
                        type: 'text',
                        message: 'Enter SSL CERT file',
                        validation: ['important'],
                    },
                    {
                        name: 'certdoms',
                        type: 'list',
                        message: 'Enter the CERT domains (comma-separated)',
                        validation: ['important'],
                    },
                    {
                        name: 'force',
                        type: 'toggle',
                        message: 'Force HTTPS?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                ],
            },
            {
                name: 'force_www',
                type: 'select',
                message: 'Force add/remove "www" on hostname?',
                choices: CHOICES.force_www,
                initial: this.indexOfInitial(CHOICES.force_www, config.force_www),
            },
            {
                name: 'shared',
                type: 'toggle',
                message: 'Shared server?',
                active: 'YES',
                inactive: 'NO',
                initial: config.shared,
            },
        ];
    }
}
