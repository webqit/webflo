
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
            bundle_filename: 'bundle.js',
            public_base_url: '/',
            spa_routing: true,
            service_worker: {
                filename: 'worker.js',
                scope: '/',
                support_push: false,
                webflo_public_webhook_url_variable: 'WEBFLO_PUBLIC_WEBHOOK_URL',
                webflo_vapid_public_key_variable: 'WEBFLO_VAPID_PUBLIC_KEY'
            },
            bundle_public_env: false,
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = this.merge({
            webqit_dependencies: [
                {value: 'externalize', title: 'Externalize'},
                {value: 'internalize', title: 'Internalize'},
            ],
        }, choices, 'patch');
        // Questions
        return [
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
                name: 'spa_routing',
                type: 'toggle',
                message: '[spa_routing]: Enable Single Page Routing Mode',
                active: 'YES',
                inactive: 'NO',
                initial: config.spa_routing,
                validation: ['important'],
            },
            {
                name: 'service_worker',
                controls: {
                    name: 'service_worker',
                },
                initial: config.service_worker,
                schema: [
                    {
                        name: 'filename',
                        type: 'text',
                        message: 'Specify the Service Worker filename',
                    },
                    {
                        name: 'scope',
                        type: 'text',
                        message: 'Specify the Service Worker scope',
                    },
                    {
                        name: 'support_push',
                        type: 'toggle',
                        message: 'Support push-notifications?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                    {
                        name: 'webflo_public_webhook_url_variable',
                        type: (prev, answers) => answers.support_push ? 'text' : null,
                        message: 'Enter the webhook URL for push notification subscription',
                    },
                    {
                        name: 'webflo_vapid_public_key_variable',
                        type: (prev, answers) => answers.support_push ? 'text' : null,
                        message: 'Enter the VAPID PUBLIC KEY variable for push notification subscription',
                    },
                ],
            },
            {
                name: 'bundle_public_env',
                type: 'toggle',
                message: '[bundle_public_env]: Bundle public ENV variables?',
                active: 'YES',
                inactive: 'NO',
                initial: config.bundle_public_env,
                validation: ['important'],
            },
        ];
    }
}
