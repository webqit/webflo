
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
            port: process.env.PORT || 3000,
            domains: [],
            https: {
                port: process.env.SSL_PORT || 0,
                domains: [],
                keyfile: '/etc/letsencrypt/live/[domain]/privkey.pem',
                certfile: '/etc/letsencrypt/live/[domain]/fullchain.pem',
                force: false,
            },
            force_www: '',
            webflo_session_key_variable: 'WEBFLO_SESSION_KEY',
            support_push: false,
            webflo_vapid_public_key_variable: 'WEBFLO_VAPID_PUBLIC_KEY',
            webflo_vapid_private_key_variable: 'WEBFLO_VAPID_PRIVATE_KEY'
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
                name: 'webflo_session_key_variable',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the SESSION KEY variable for session ID encryption',
            },
            {
                name: 'support_push',
                type: 'toggle',
                message: 'Support push-notifications?',
                active: 'YES',
                inactive: 'NO',
            },
            {
                name: 'webflo_vapid_public_key_variable',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the VAPID PUBLIC KEY variable for push notification setup',
            },
            {
                name: 'webflo_vapid_private_key_variable',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the VAPID PRIVATE KEY variable for push notification setup',
            },
        ];
    }
}
