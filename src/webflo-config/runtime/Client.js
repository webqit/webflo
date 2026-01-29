
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
            filename: 'app.js',
            public_base_url: '/',
            copy_public_variables: true,
            spa_routing: true,
            capabilities: {
                service_worker: false,
                webpush: false,
                custom_install: false,
                exposed: ['display-mode', 'notifications'],
            },
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'filename',
                type: 'text',
                message: 'Specify the bundle filename',
                initial: config.filename,
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
                name: 'spa_routing',
                type: 'toggle',
                message: '[spa_routing]: Enable Single Page Routing Mode',
                active: 'YES',
                inactive: 'NO',
                initial: config.spa_routing,
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
                    }
                ]
            }
        ];
    }
}
