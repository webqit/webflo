
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _isNumeric from '@webqit/util/js/isNumeric.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads WORKER from file.
 * 
 * @param object    layout
 * 
 * @return object
 */
export async function read(layout = {}) {
    const config = DotJson.read(Path.join(layout.ROOT || '', './.webflo/config/client.json'));
    return _merge({
        // -----------------
        // SERVICE WORKER
        // -----------------
        worker: {
            scope: '/',
            cache_name: 'cache_v0',
            fetching_strategy: 'cache_first',
            dynamic_caching_list: [],
            static_caching_list: [],
            skip_waiting: false,
            lifecycle_logs: true,
            // -----------------
            support_push: false,
            push_registration_url: '',
            push_deregistration_url: '',
            push_public_key: '',
        },
    }, config);
};

/**
 * Writes WORKER to file.
 * 
 * @param object    config
 * @param object    layout
 * 
 * @return void
 */
export async function write(config, layout = {}) {
    DotJson.write(config, Path.join(layout.ROOT || '', './.webflo/config/client.json'));
};

/**
 * Configures WORKER.
 * 
 * @param object    config
 * @param object    choices
 * @param object    layout
 * 
 * @return Array
 */
export async function questions(config, choices = {}, layout = {}) {

    // Increment cache
    if (config.cache_name && config.cache_name.indexOf('_v') > -1 && _isNumeric(_after(config.cache_name, '_v'))) {
        config.cache_name = _before(config.cache_name, '_v') + '_v' + (parseInt(_after(config.cache_name, '_v')) + 1);
    }

    // Choices hash...
    const CHOICES = _merge({
        worker_fetching_strategy: [
            {value: 'network_first',},
            {value: 'cache_first',},
            {value: 'auto',},
        ],
    }, choices);

    // Questions
    return [
        // -----------------
        // SERVICE WORKER
        // -----------------
        {
            name: 'client',
            initial: config.client,
            controls: {
                name: 'client params',
            },
            questions: [
            ],
        },
        // -----------------
        // SERVICE WORKER
        // -----------------
        {
            name: 'worker',
            initial: config.worker,
            controls: {
                name: 'Service Worker',
            },
            questions: [
                {
                    name: 'scope',
                    type: 'text',
                    message: 'Specify the Service Worker scope',
                    initial: config.scope,
                },
                {
                    name: 'cache_name',
                    type: 'text',
                    message: 'Enter the Service Worker cache name',
                    initial: config.cache_name,
                },
                {
                    name: 'fetching_strategy',
                    type: 'select',
                    message: 'Select the Service Worker fetching strategy',
                    choices: CHOICES.worker_fetching_strategy,
                    initial: initialGetIndex(CHOICES.worker_fetching_strategy, config.fetching_strategy),
                },
                {
                    name: 'static_caching_list',
                    type: 'list',
                    message: 'Specify files to statically cache (comma-separated)',
                    initial: (config.static_caching_list || []).join(', '),
                },
                {
                    name: 'dynamic_caching_list',
                    type: 'list',
                    message: 'Specify files to dynamically cache (comma-separated)',
                    initial: (config.dynamic_caching_list || []).join(', '),
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
                    name: 'lifecycle_logs',
                    type: 'toggle',
                    message: 'Choose whether to show logs',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.lifecycle_logs,
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
            ],
        },
    ];
};
