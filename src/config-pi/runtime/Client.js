
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
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
        return _merge(true, {
            bundle_filename: 'bundle.js',
            public_base_url: '/',
            address_bar_synchrony: 'standard',
            oohtml_support: 'full',
            service_worker_support: true,
            worker_scope: '/',
            worker_filename: 'worker.js',
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Choices
        const CHOICES = _merge({
            address_bar_synchrony: [
                {value: 'standard', title: 'standard - on response'},
                {value: 'instant', title: 'instant - on request'},
            ],
            oohtml_support: [
                {value: 'full', title: 'Full'},
                {value: 'namespacing', title: 'namespacing'},
                {value: 'scripting', title: 'scripting'},
                {value: 'templating', title: 'templating'},
                {value: 'none', title: 'none'},
            ],
        }, choices);
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
                name: 'address_bar_synchrony',
                type: 'select',
                message: '[address_bar_synchrony]: Specify how the address bar synchronizes with navigation',
                choices: CHOICES.address_bar_synchrony,
                initial: this.indexOfInitial(CHOICES.address_bar_synchrony, config.address_bar_synchrony),
                validation: ['important'],
            },
            {
                name: 'oohtml_support',
                type: 'select',
                message: '[oohtml_support]: (Adds OOHTML to your app\'s bundle.) Specify OOHTML support level',
                choices: CHOICES.oohtml_support,
                initial: this.indexOfInitial(CHOICES.oohtml_support, config.oohtml_support),
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
