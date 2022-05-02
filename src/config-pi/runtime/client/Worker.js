
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
import Configurator from '../../../Configurator.js';

export default class Worker extends Configurator {

    // Base name
    get name() {
        return 'worker';
    }

    // @desc
    static get ['@desc']() {
        return 'Application Service Worker config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            cache_name: 'cache_v0',
            cache_only_urls: [],
            cache_first_urls: [],
            network_only_urls: [],
            network_first_urls: [],
            skip_waiting: false,
            // -----------------
            support_push: false,
            push_registration_url: '',
            push_deregistration_url: '',
            push_public_key: '',
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Increment cache
        if (config.cache_name && config.cache_name.indexOf('_v') > -1 && _isNumeric(_after(config.cache_name, '_v'))) {
            config.cache_name = _before(config.cache_name, '_v') + '_v' + (parseInt(_after(config.cache_name, '_v')) + 1);
        }
        // Questions
        return [
            {
                name: 'cache_name',
                type: 'text',
                message: 'Enter the Service Worker cache name',
                initial: config.cache_name,
            },
            {
                name: 'cache_only_urls',
                type: 'list',
                message: 'Specify URLs for a "cache-only" fetching strategy (comma-separated, globe supported)',
                initial: (config.cache_only_urls || []).join(', '),
            },
            {
                name: 'cache_first_urls',
                type: 'list',
                message: 'Specify URLs for a "cache-first-then-network" fetching strategy (comma-separated, globe supported)',
                initial: (config.cache_first_urls || []).join(', '),
            },
            {
                name: 'network_only_urls',
                type: 'list',
                message: 'Specify URLs for a "network-only" fetching strategy (comma-separated, globe supported)',
                initial: (config.network_only_urls || []).join(', '),
            },
            {
                name: 'network_first_urls',
                type: 'list',
                message: 'Specify URLs for a "network-first-then-cache" fetching strategy (comma-separated, globe supported)',
                initial: (config.network_first_urls || []).join(', '),
            },
            {
                name: 'skip_waiting',
                type: 'toggle',
                message: 'Choose whether to skip the "waiting" state for updated Service Workers',
                active: 'YES',
                inactive: 'NO',
                initial: config.skip_waiting,
            },
            // ------------- notification --------------
            {
                name: 'support_push',
                type: 'toggle',
                message: 'Support push-notifications?',
                active: 'YES',
                inactive: 'NO',
                initial: config.support_push,
            },
            {
                name: 'push_registration_url',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the URL for push notification subscription',
                initial: config.push_registration_url,
                validation: ['important'],
            },
            {
                name: 'push_deregistration_url',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the URL for push notification unsubscription',
                initial: config.push_deregistration_url,
                validation: ['important'],
            },
            {
                name: 'push_key',
                type: (prev, answers) => answers.support_push ? 'text' : null,
                message: 'Enter the Public Key for push notification subscription',
                initial: config.push_key,
                validation: ['important'],
            },
        ];
    }
}
