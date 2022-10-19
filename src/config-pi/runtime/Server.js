
/**
 * imports
 */
import { Dotfile } from '@webqit/backpack';

export default class Server extends Dotfile {

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
        return this.merge({
            port: process.env.port || 3000,
            domains: [],
            force_www: '',
            https: {
                port: 0,
                keyfile: '',
                certfile: '',
                domains: [],
                force: false,
            },
            oohtml_support: 'full',
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = this.merge({
            force_www: [
                {value: '', title: 'do nothing'},
                {value: 'add',},
                {value: 'remove',},
            ],
            oohtml_support: [
                {value: 'full', title: 'full'},
                {value: 'namespacing', title: 'namespacing'},
                {value: 'scripting', title: 'scripting'},
                {value: 'templating', title: 'templating'},
                {value: 'none', title: 'none'},
            ],
        }, choices, 'patch');
        // Questions
        return [
            {
                name: 'port',
                type: 'number',
                message: '[port]: Enter port number',
                initial: config.port,
                validation: ['important'],
            },
            {
                name: 'domains',
                type: 'list',
                message: '[domains]: Enter a list of allowed domains if necessary (comma-separated)',
                validation: ['important'],
            },
            {
                name: 'force_www',
                type: 'select',
                message: '[force_www]: Force add/remove "www" on hostname?',
                choices: CHOICES.force_www,
                initial: this.indexOfInitial(CHOICES.force_www, config.force_www),
            },
            {
                name: 'https',
                controls: {
                    name: 'https',
                },
                initial: config.https,
                schema: [
                    {
                        name: 'port',
                        type: 'number',
                        message: '[port]: Enter HTTPS port number',
                        validation: ['important'],
                    },
                    {
                        name: 'keyfile',
                        type: 'text',
                        message: '[keyfile]: Enter SSL KEY file',
                        validation: ['important'],
                    },
                    {
                        name: 'certfile',
                        type: 'text',
                        message: '[certfile]: Enter SSL CERT file',
                        validation: ['important'],
                    },
                    {
                        name: 'domains',
                        type: 'list',
                        message: '[domains]: Enter the CERT domains (comma-separated)',
                        validation: ['important'],
                    },
                    {
                        name: 'force',
                        type: 'toggle',
                        message: '[force]: Force HTTPS?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                ],
            },
            {
                name: 'oohtml_support',
                type: 'select',
                message: '[oohtml_support]: Specify OOHTML support level',
                choices: CHOICES.oohtml_support,
                initial: this.indexOfInitial(CHOICES.oohtml_support, config.oohtml_support),
                validation: ['important'],
            },
        ];
    }
}
