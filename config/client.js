
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
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    const config = DotJson.read(Path.join(params.ROOT || '', './.webflo/config/client.json'));
    return _merge({
        PUBLIC_DIR: './public',
        CLIENT_DIR: './client',
        // -----------------
        // SERVICE WORKER
        // -----------------
        CREATE_WORKER: false,
        WORKER_DIR: './worker',
        WORKER_SHOW_LIFECYCLE_LOG: true,
        // -----------------
        WORKER_SCOPE: '/',
        WORKER_CACHE_NAME: 'cache_v0',
        WORKER_FETCHING_STRATEGY: 'cache_first',
        WORKER_CACHING_STRATEGY: 'dynamic',
        WORKER_CACHING_LIST: [],
        WORKER_SKIP_WAITING: false,
        // -----------------
        WORKER_SUPPORT_MESSAGING: true,
        WORKER_MESSAGE_ROUTING_URL_PROPERTY: '',
        WORKER_MESSAGE_SHOULD_RELAY_PROPERTY: '',
        // -----------------
        WORKER_SUPPORT_NOTIFICATION: false,
        WORKER_PUSH_REGISTRATION_URL: '',
        WORKER_PUSH_UNREGISTRATION_URL: '',
        WORKER_PUSH_PUBLIC_KEY: '',
        WORKER_NOTIFICATION_ROUTING_URL_PROPERTY: '',
        WORKER_NOTIFICATION_TARGET_URL_PROPERTY: '',
    }, config);
};

/**
 * Writes WORKER to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/client.json'));
};

/**
 * Configures WORKER.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Increment cache
    if (config.WORKER_CACHE_NAME && config.WORKER_CACHE_NAME.indexOf('_v') > -1 && _isNumeric(_after(config.WORKER_CACHE_NAME, '_v'))) {
        config.WORKER_CACHE_NAME = _before(config.WORKER_CACHE_NAME, '_v') + '_v' + (parseInt(_after(config.WORKER_CACHE_NAME, '_v')) + 1);
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
        {
            name: 'PUBLIC_DIR',
            type: 'text',
            message: 'Enter the application\'s public directory',
            initial: config.PUBLIC_DIR,
            validation: ['important'],
        },
        {
            name: 'CLIENT_DIR',
            type: 'text',
            message: 'Enter the application\'s client-side routing directory',
            initial: config.CLIENT_DIR,
            validation: ['important'],
        },
        // ------------- advanced --------------
        {
            name: '__client_advanced',
            type: 'toggle',
            message: 'Show advanced options?',
            active: 'YES',
            inactive: 'NO',
            initial: config.__client_advanced,
        },
        // -----------------
        // SERVICE WORKER
        // -----------------
        {
            name: 'CREATE_WORKER',
            type: 'toggle',
            message: 'Create a Progressive Web App (PWA) Service Worker',
            active: 'YES',
            inactive: 'NO',
            initial: config.CREATE_WORKER,
        },
        {
            name: 'WORKER_DIR',
            type: (prev, answers) => answers.CREATE_WORKER ? 'text' : null,
            message: 'Enter the application\'s worker-level routing directory',
            initial: config.WORKER_DIR,
        },
        {
            name: 'WORKER_SHOW_LIFECYCLE_LOG',
            type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
            message: 'Choose whether to show logs',
            active: 'YES',
            inactive: 'NO',
            initial: config.WORKER_SHOW_LIFECYCLE_LOG,
        },
        // ------------- advanced --------------
        {
            name: '__worker_advanced',
            type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
            message: 'Show advanced Service Worker options?',
            active: 'YES',
            inactive: 'NO',
            initial: config.__worker_advanced,
        },
        // ------------- advanced --------------
        {
            name: 'WORKER_SCOPE',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'text' : null,
            message: 'Specify the Service Worker scope',
            initial: config.WORKER_SCOPE,
        },
        {
            name: 'WORKER_CACHE_NAME',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'text' : null,
            message: 'Enter the Service Worker cache name',
            initial: config.WORKER_CACHE_NAME,
        },
        {
            name: 'WORKER_FETCHING_STRATEGY',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'select' : null,
            message: 'Select the Service Worker fetching strategy',
            choices: CHOICES.worker_fetching_strategy,
            initial: initialGetIndex(CHOICES.worker_fetching_strategy, config.WORKER_FETCHING_STRATEGY),
        },
        {
            name: 'WORKER_CACHING_STRATEGY',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'select' : null,
            message: 'Select the Service Worker caching strategy',
            choices: CHOICES.worker_cahing_strategy,
            initial: initialGetIndex(CHOICES.worker_cahing_strategy, config.WORKER_CACHING_STRATEGY),
        },
        {
            name: 'WORKER_CACHING_LIST',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'list' : null,
            message: 'Specify files to cache (comma-separated)',
            initial: (config.WORKER_CACHING_LIST || []).join(', '),
        },
        {
            name: 'WORKER_SKIP_WAITING',
            type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'toggle' : null,
            message: 'Choose whether to skip the "waiting" state for updated Service Workers',
            active: 'YES',
            inactive: 'NO',
            initial: config.WORKER_SKIP_WAITING,
        },
        // ------------- messaging --------------
        {
            name: 'WORKER_SUPPORT_MESSAGING',
            type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
            message: 'Support worker-clients post-messaging?',
            active: 'YES',
            inactive: 'NO',
            initial: config.WORKER_SUPPORT_MESSAGING,
        },
        // ------------- messaging --------------
        // ------------- messaging advanced --------------
        {
            name: '__messaging_advanced',
            type: (prev, answers) => answers.WORKER_SUPPORT_MESSAGING ? 'toggle' : null,
            message: 'Show advanced post-messaging options?',
            active: 'YES',
            inactive: 'NO',
            initial: config.__messaging_advanced,
        },
        // ------------- messaging advanced --------------
        {
            name: 'WORKER_MESSAGE_ROUTING_URL_PROPERTY',
            type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
            message: 'Enter a Message Object\'s URL property for routing post-messages',
            initial: config.WORKER_MESSAGE_ROUTING_URL_PROPERTY,
        },
        {
            name: 'WORKER_MESSAGE_SHOULD_RELAY_PROPERTY',
            type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
            message: 'Enter a Message Object\'s relay property for relaying post-messages',
            initial: config.WORKER_MESSAGE_SHOULD_RELAY_PROPERTY,
        },
        // ------------- notification --------------
        {
            name: 'WORKER_SUPPORT_NOTIFICATION',
            type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
            message: 'Support push-notifications?',
            active: 'YES',
            inactive: 'NO',
            initial: config.WORKER_SUPPORT_NOTIFICATION,
        },
        // ------------- notification --------------
        {
            name: 'WORKER_PUSH_REGISTRATION_URL',
            type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
            message: 'Enter the URL for push notification subscription',
            initial: config.WORKER_PUSH_REGISTRATION_URL,
            validation: ['important'],
        },
        {
            name: 'WORKER_PUSH_UNREGISTRATION_URL',
            type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
            message: 'Enter the URL for push notification unsubscription',
            initial: config.WORKER_PUSH_UNREGISTRATION_URL,
            validation: ['important'],
        },
        {
            name: 'WORKER_PUSH_PUBLIC_KEY',
            type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
            message: 'Enter the Public Key for push notification subscription',
            initial: config.WORKER_PUSH_PUBLIC_KEY,
            validation: ['important'],
        },
        // ------------- notification advanced --------------
        {
            name: '__notification_advanced',
            type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'toggle' : null,
            message: 'Show advanced push-notifications options?',
            active: 'YES',
            inactive: 'NO',
            initial: config.__notification_advanced,
        },
        // ------------- notification advanced --------------
        {
            name: 'WORKER_NOTIFICATION_ROUTING_URL_PROPERTY',
            type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
            message: 'Enter a Notification Object\'s URL property for routing push notifications',
            initial: config.WORKER_NOTIFICATION_ROUTING_URL_PROPERTY,
        },
        {
            name: 'WORKER_NOTIFICATION_TARGET_URL_PROPERTY',
            type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
            message: 'Enter a Notification Object\'s URL property name for notification targeting',
            initial: config.WORKER_NOTIFICATION_TARGET_URL_PROPERTY,
        },

    ];
};
