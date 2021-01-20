
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
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    const config = DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/client.json'));
    return _merge({
        // -----------------
        // SERVICE WORKER
        // -----------------
        worker: {
            lifecycle_logs: true,
            // -----------------
            scope: '/',
            cache_name: 'cache_v0',
            fetching_strategy: 'cache_first',
            caching_strategy: 'dynamic',
            caching_list: [],
            skip_waiting: false,
            // -----------------
            support_messaging: true,
            message_routing_url_property: '',
            message_relay_flag_property: '',
            // -----------------
            support_notification: false,
            push_registration_url: '',
            push_deregistration_url: '',
            push_public_key: '',
            notification_routing_url_property: '',
            notification_target_url_property: '',
        },
    }, config);
};

/**
 * Writes WORKER to file.
 * 
 * @param object    config
 * @param object    setup
 * 
 * @return void
 */
export async function write(config, setup = {}) {
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/client.json'));
};

/**
 * Configures WORKER.
 * 
 * @param object    config
 * @param object    choices
 * @param object    setup
 * 
 * @return Array
 */
export async function questions(config, choices = {}, setup = {}) {

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
        worker_cahing_strategy:[
            {value: 'dynamic',},
            {value: 'static',},
            {value: 'none',},
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
                    name: 'dir',
                    type: 'text',
                    message: 'Enter the application\'s worker-level routing directory',
                    initial: config.dir,
                },
                {
                    name: 'lifecycle_logs',
                    type: 'toggle',
                    message: 'Choose whether to show logs',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.lifecycle_logs,
                },
                // ------------- advanced --------------
                {
                    name: '__advanced',
                    type: 'toggle',
                    message: 'Show advanced Service Worker options?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.__advanced,
                },
                // ------------- advanced --------------
                {
                    name: 'scope',
                    type: (prev, answers) => answers.__advanced ? 'text' : null,
                    message: 'Specify the Service Worker scope',
                    initial: config.scope,
                },
                {
                    name: 'cache_name',
                    type: (prev, answers) => answers.__advanced ? 'text' : null,
                    message: 'Enter the Service Worker cache name',
                    initial: config.cache_name,
                },
                {
                    name: 'fetching_strategy',
                    type: (prev, answers) => answers.__advanced ? 'select' : null,
                    message: 'Select the Service Worker fetching strategy',
                    choices: CHOICES.worker_fetching_strategy,
                    initial: initialGetIndex(CHOICES.worker_fetching_strategy, config.fetching_strategy),
                },
                {
                    name: 'caching_strategy',
                    type: (prev, answers) => answers.__advanced ? 'select' : null,
                    message: 'Select the Service Worker caching strategy',
                    choices: CHOICES.worker_cahing_strategy,
                    initial: initialGetIndex(CHOICES.worker_cahing_strategy, config.caching_strategy),
                },
                {
                    name: 'caching_list',
                    type: (prev, answers) => answers.__advanced ? 'list' : null,
                    message: 'Specify files to cache (comma-separated)',
                    initial: (config.caching_list || []).join(', '),
                },
                {
                    name: 'skip_waiting',
                    type: (prev, answers) => answers.__advanced ? 'toggle' : null,
                    message: 'Choose whether to skip the "waiting" state for updated Service Workers',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.skip_waiting,
                },
                // ------------- messaging --------------
                {
                    name: 'support_messaging',
                    type: 'toggle',
                    message: 'Support worker-clients post-messaging?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.support_messaging,
                },
                // ------------- messaging --------------
                // ------------- messaging advanced --------------
                {
                    name: '__messaging_advanced',
                    type: (prev, answers) => answers.support_messaging ? 'toggle' : null,
                    message: 'Show advanced post-messaging options?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.__messaging_advanced,
                },
                // ------------- messaging advanced --------------
                {
                    name: 'message_routing_url_property',
                    type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
                    message: 'Enter a Message Object\'s URL property for routing post-messages',
                    initial: config.message_routing_url_property,
                },
                {
                    name: 'message_relay_flag_property',
                    type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
                    message: 'Enter a Message Object\'s relay property for relaying post-messages',
                    initial: config.message_relay_flag_property,
                },
                // ------------- notification --------------
                {
                    name: 'support_notification',
                    type: 'toggle',
                    message: 'Support push-notifications?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.support_notification,
                },
                // ------------- notification --------------
                {
                    name: 'push_registration_url',
                    type: (prev, answers) => answers.support_notification ? 'text' : null,
                    message: 'Enter the URL for push notification subscription',
                    initial: config.push_registration_url,
                    validation: ['important'],
                },
                {
                    name: 'push_deregistration_url',
                    type: (prev, answers) => answers.support_notification ? 'text' : null,
                    message: 'Enter the URL for push notification unsubscription',
                    initial: config.push_deregistration_url,
                    validation: ['important'],
                },
                {
                    name: 'push_key',
                    type: (prev, answers) => answers.support_notification ? 'text' : null,
                    message: 'Enter the Public Key for push notification subscription',
                    initial: config.push_key,
                    validation: ['important'],
                },
                // ------------- notification advanced --------------
                {
                    name: '__notification_advanced',
                    type: (prev, answers) => answers.support_notification ? 'toggle' : null,
                    message: 'Show advanced push-notifications options?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.__notification_advanced,
                },
                // ------------- notification advanced --------------
                {
                    name: 'notification_routing_url_property',
                    type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
                    message: 'Enter a Notification Object\'s URL property for routing push notifications',
                    initial: config.notification_routing_url_property,
                },
                {
                    name: 'notification_target_url_property',
                    type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
                    message: 'Enter a Notification Object\'s URL property name for notification targeting',
                    initial: config.notification_target_url_property,
                },
            ],
        },
    ];
};
