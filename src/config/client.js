
/**
 * imports
 */
 import Fs from 'fs';
 import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _isNumeric from '@webqit/util/js/isNumeric.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads WORKER from file.
 * 
 * @param object    flags
 * @param object    layout
 * 
 * @return object
 */
export async function read(flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/client${ext}.json`;
    const config = DotJson.read(ext && Fs.existsSync(configFile(ext)) ? configFile(ext) : configFile(''));
    return _merge({
        // -----------------
        // SERVICE WORKER
        // -----------------
        worker: {
            scope: '/',
            cache_name: 'cache_v0',
            cache_only_url_list: [],
            cache_first_url_list: [],
            network_first_url_list: [],
            network_only_url_list: [],
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
 * @param object    flags
 * @param object    layout
 * 
 * @return void
 */
export async function write(config, flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/client${ext}.json`;
    DotJson.write(config, ext ? configFile(ext) : configFile(''));
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
    if (config.worker.cache_name && config.worker.cache_name.indexOf('_v') > -1 && _isNumeric(_after(config.worker.cache_name, '_v'))) {
        config.worker.cache_name = _before(config.worker.cache_name, '_v') + '_v' + (parseInt(_after(config.worker.cache_name, '_v')) + 1);
    }

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
                    name: 'cache_only_url_list',
                    type: 'list',
                    message: 'Specify URLs for a "cache-only" fetching strategy (comma-separated, globe supported)',
                    initial: (config.cache_only_url_list || []).join(', '),
                },
                {
                    name: 'cache_first_url_list',
                    type: 'list',
                    message: 'Specify URLs for a "cache-first-then-network" fetching strategy (comma-separated, globe supported)',
                    initial: (config.cache_first_url_list || []).join(', '),
                },
                {
                    name: 'network_first_url_list',
                    type: 'list',
                    message: 'Specify URLs for a "network-first-then-cache" fetching strategy (comma-separated, globe supported)',
                    initial: (config.network_first_url_list || []).join(', '),
                },
                {
                    name: 'network_only_url_list',
                    type: 'list',
                    message: 'Specify URLs for a "network-only" fetching strategy (comma-separated, globe supported)',
                    initial: (config.network_only_url_list || []).join(', '),
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
