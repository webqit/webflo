
/**
 * imports
 */
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Worker extends Dotfile {

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
        return this.merge({
            filename: 'worker.js',
            scope: '/',
            skip_waiting: true,
            cache_name: 'cache_v0',
            default_fetching_strategy: 'network-first',
            network_first_urls: [],
            cache_first_urls: [],
            network_only_urls: [],
            cache_only_urls: [],
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Increment cache
        if (config.cache_name && config.cache_name.indexOf('_v') > -1 && _isNumeric(_after(config.cache_name, '_v'))) {
            config.cache_name = _before(config.cache_name, '_v') + '_v' + (parseInt(_after(config.cache_name, '_v')) + 1);
        }
        // Choices
        const CHOICES = this.merge({
            default_fetching_strategy: [
                {value: 'network-first', title: 'Network-first (Webflo default)'},
                {value: 'cache-first', title: 'Cache-first'},
                {value: 'network-only', title: 'Network-only'},
                {value: 'cache-only', title: 'Cache-only'},
            ],
        }, choices, 'patch');
        // Questions
        return [
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
                name: 'skip_waiting',
                type: 'toggle',
                message: 'Choose whether to skip the "waiting" state for updated Service Workers',
                active: 'YES',
                inactive: 'NO',
                initial: config.skip_waiting,
            },
            {
                name: 'cache_name',
                type: 'text',
                message: 'Enter the Service Worker cache name',
                initial: config.cache_name,
            },
            {
                name: 'default_fetching_strategy',
                type: 'select',
                message: '[default_fetching_strategy]: Choose the default fetching strategy',
                choices: CHOICES.default_fetching_strategy,
                initial: this.indexOfInitial(CHOICES.default_fetching_strategy, config.default_fetching_strategy),
                validation: ['important'],
            },
            {
                name: 'network_first_urls',
                type: (prev, answers) => answers.default_fetching_strategy === 'network-first' ? null : 'list',
                message: 'Specify URLs for a "network-first-then-cache" fetching strategy (comma-separated, globe supported)',
                initial: (config.network_first_urls || []).join(', '),
            },
            {
                name: 'cache_first_urls',
                type: (prev, answers) => answers.default_fetching_strategy === 'cache-first' ? null : 'list',
                message: 'Specify URLs for a "cache-first-then-network" fetching strategy (comma-separated, globe supported)',
                initial: (config.cache_first_urls || []).join(', '),
            },
            {
                name: 'network_only_urls',
                type: (prev, answers) => answers.default_fetching_strategy === 'network-only' ? null : 'list',
                message: 'Specify URLs for a "network-only" fetching strategy (comma-separated, globe supported)',
                initial: (config.network_only_urls || []).join(', '),
            },
            {
                name: 'cache_only_urls',
                type: (prev, answers) => answers.default_fetching_strategy === 'cache-only' ? null : 'list',
                message: 'Specify URLs for a "cache-only" fetching strategy (comma-separated, globe supported)',
                initial: (config.cache_only_urls || []).join(', '),
            }
        ];
    }
}
