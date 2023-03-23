
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
            webqit_dependencies: '',
            service_worker_support: true,
            worker_scope: '/',
            worker_filename: 'worker.js',
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
                initial: DATA.public_base_url,
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
                name: 'webqit_dependencies',
                type: 'select',
                message: '[webqit_dependencies]: (Adds OOHTML to your app\'s bundle.) Specify OOHTML support level',
                choices: CHOICES.webqit_dependencies,
                initial: this.indexOfInitial(CHOICES.webqit_dependencies, config.webqit_dependencies),
                validation: ['important'],
            },
            {
                name: 'service_worker_support',
                type: 'toggle',
                message: 'Support Service Worker?',
                active: 'YES',
                inactive: 'NO',
                initial: config.service_worker_support,
            },
            {
                name: 'worker_scope',
                type: (prev, answers) => answers.service_worker_support ? 'text' : null,
                message: 'Specify the Service Worker scope',
                initial: config.worker_scope,
            },
            {
                name: 'worker_filename',
                type: (prev, answers) => answers.service_worker_support ? 'text' : null,
                message: 'Specify the Service Worker filename',
                initial: config.worker_filename,
            },
        ];
    }
}
