
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
            session_key_variable: 'SESSION_KEY',
            capabilities: {
                database: false,
                database_dialect: 'postgres',
                database_url_variable: 'DATABASE_URL',
                redis: false,
                redis_url_variable: 'REDIS_URL',
                webpush: false,
                vapid_subject: 'mailto:foo@example.com',
                vapid_public_key_variable: 'VAPID_PUBLIC_KEY',
                vapid_private_key_variable: 'VAPID_PRIVATE_KEY',
            },
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
                initial: (config.domains || []).join(', '),
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
                name: 'session_key_variable',
                type: 'text',
                message: 'Enter the environment variable name for SESSION_KEY if not as written',
                initial: config.session_key_variable,
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
                name: 'capabilities',
                controls: {
                    name: 'capabilities',
                },
                initial: config.capabilities,
                schema: [
                    {
                        name: 'database',
                        type: 'toggle',
                        message: 'Add database integration?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'database_dialect',
                        type: (prev, answers) => !answers.database ? null : 'text',
                        message: 'Enter the database dialect (postgres for now)',
                    },
                    {
                        name: 'database_url_variable',
                        type: (prev, answers) => !answers.database ? null : 'text',
                        message: 'Enter the environment variable name for DATABASE_URL if not as written',
                    },
                    {
                        name: 'redis',
                        type: 'toggle',
                        message: 'Add redis integration?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'redis_url_variable',
                        type: (prev, answers) => !answers.redis ? null : 'text',
                        message: 'Enter the environment variable name for REDIS_URL if not as written',
                    },
                    {
                        name: 'webpush',
                        type: 'toggle',
                        message: 'Add webpush integration?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'vapid_subject',
                        type: (prev, answers) => !answers.webpush ? null : 'text',
                        message: 'Enter the vapid_subject URL',
                    },
                    {
                        name: 'vapid_public_key_variable',
                        type: (prev, answers) => !answers.webpush ? null : 'text',
                        message: 'Enter the environment variable name for VAPID_PUBLIC_KEY if not as written',
                    },
                    {
                        name: 'vapid_private_key_variable',
                        type: (prev, answers) => !answers.webpush ? null : 'text',
                        message: 'Enter the environment variable name for VAPID_PRIVATE_KEY if not as written',
                    },
                ]
            },
        ];
    }
}
