
/**
 * imports
 */
import { Dotfile } from '@webqit/backpack';

export default class Client extends Dotfile {

    // Base name
    get name() {
        return 'client';
    }

    // @desc
    static get ['@desc']() {
        return 'Client Runtime config.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            spa_routing: true,
            bundle_filename: 'bundle.js',
            public_base_url: '/',
            copy_public_variables: true,
            capabilities: {
                service_worker: true,
                webpush: false,
                custom_install: false,
                exposed: ['display-mode', 'notifications'],
                app_vapid_public_key_variable: 'APP_VAPID_PUBLIC_KEY',
                app_public_webhook_url_variable: 'APP_PUBLIC_WEBHOOK_URL',
            },
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'spa_routing',
                type: 'toggle',
                message: '[spa_routing]: Enable Single Page Routing Mode',
                active: 'YES',
                inactive: 'NO',
                initial: config.spa_routing,
                validation: ['important'],
            },
            {
                name: 'bundle_filename',
                type: 'text',
                message: 'Specify the bundle filename',
                initial: config.bundle_filename,
            },
            {
                name: 'public_base_url',
                type: 'text',
                message: '[public_base_url]: Enter the base-URL for public resource URLs',
                initial: config.public_base_url,
                validation: ['important'],
            },
            {
                name: 'copy_public_variables',
                type: 'toggle',
                message: '[copy_public_variables]: Bundle public ENV variables?',
                active: 'YES',
                inactive: 'NO',
                initial: config.copy_public_variables,
                validation: ['important'],
            },
            {
                name: 'capabilities',
                controls: {
                    name: 'capabilities',
                },
                initial: config.capabilities,
                schema: [
                    {
                        name: 'service_worker',
                        type: 'toggle',
                        message: 'Enable service worker?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'webpush',
                        type: 'toggle',
                        message: 'Support push-notifications?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'custom_install',
                        type: 'toggle',
                        message: 'Enable custom PWA install prompt?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'exposed',
                        type: 'list',
                        message: 'Specify features exposed on capabilities.exposed',
                        initial: (config.exposed || []).join(', '),
                    },
                    {
                        name: 'app_vapid_public_key_variable',
                        type: (prev, answers) => !answers.webpush ? null : 'text',
                        message: 'Enter the environment variable name for APP_VAPID_PUBLIC_KEY if not as written',
                    },
                    {
                        name: 'app_public_webhook_url_variable',
                        type: 'text',
                        message: 'Enter the environment variable name for APP_PUBLIC_WEBHOOK_URL if not as written',
                    },
                ]
            }
        ];
    }
}
