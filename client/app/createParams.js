
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Chalk from 'chalk';
import Clear from 'clear';
import _merge from '@onephrase/util/obj/merge.js';
import _before from '@onephrase/util/str/before.js';
import _after from '@onephrase/util/str/after.js';
import _isNumeric from '@onephrase/util/js/isNumeric.js';
import Promptx, { initialGetIndex, validateAs, transformAs } from '@onephrase/util/cli/Promptx.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import printArgs from '@onephrase/util/cli/printArgs.js';

/**
 * Obtains parameters for initializing a server.
 * 
 * @param string    ROOT
 * @param object    flags
 * @param bool      ellipsis
 * @param object    pkg
 * 
 * @return Promise
 */
export default async function(ROOT, flags, ellipsis, pkg) {
    Clear();
    var _params = {}, _paramsFile;
    if (Fs.existsSync(_paramsFile = Path.join(ROOT, flags['CONFIG'] || './.webflo/config/build.json'))) {
        _params = DotJson.read(_paramsFile);
    }
    // Increment cache
    if (_params.WORKER_CACHE_NAME && _params.WORKER_CACHE_NAME.indexOf('_v') > -1 && _isNumeric(_after(_params.WORKER_CACHE_NAME, '_v'))) {
        _params.WORKER_CACHE_NAME = _before(_params.WORKER_CACHE_NAME, '_v') + '_v' + (parseInt(_after(_params.WORKER_CACHE_NAME, '_v')) + 1);
    }

    // -------------------
    // Create server parameters
    // -------------------
    var params = _merge({
        ROOT,
        PUBLIC_DIR: './public',
        CLIENT_DIR: './client',
        CLIENT_HOST_PATH: '',
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

    }, _params, flags);

    // Choices hash...
    const choices = {
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
    };
    
    if (ellipsis) {
        var questions = [
            {
                name: 'PUBLIC_DIR',
                type: 'text',
                message: 'Enter the application\'s public directory:',
                initial: params.PUBLIC_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'CLIENT_DIR',
                type: 'text',
                message: 'Enter the application\'s client-side routing directory:',
                initial: params.CLIENT_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input', 'important']),
            },
            // ------------- advanced --------------
            {
                name: '__client_advanced',
                type: 'toggle',
                message: 'Show advanced options?',
                active: 'YES',
                inactive: 'NO',
                initial: params.__client_advanced,
            },
            // ------------- advanced --------------
            {
                name: 'CLIENT_HOST_PATH',
                type: (rev, answers) => answers.__client_advanced ? 'text' : null,
                message: 'Enter the application\'s host path (in a multi-host setup):',
                initial: params.CLIENT_HOST_PATH,
                validate: validateAs(['input']),
            },
            // -----------------
            // SERVICE WORKER
            // -----------------
            {
                name: 'CREATE_WORKER',
                type: 'toggle',
                message: 'Create a Progressive Web App (PWA) Service Worker:',
                active: 'YES',
                inactive: 'NO',
                initial: params.CREATE_WORKER,
                validate: validateAs(['confirm']),
            },
            {
                name: 'WORKER_DIR',
                type: (prev, answers) => answers.CREATE_WORKER ? 'text' : null,
                message: 'Enter the application\'s worker-level routing directory:',
                initial: params.WORKER_DIR,
                format: transformAs(['path']),
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_SHOW_LIFECYCLE_LOG',
                type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
                message: 'Choose whether to show logs:',
                active: 'YES',
                inactive: 'NO',
                initial: params.WORKER_SHOW_LIFECYCLE_LOG,
            },
            // ------------- advanced --------------
            {
                name: '__worker_advanced',
                type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
                message: 'Show advanced Service Worker options?',
                active: 'YES',
                inactive: 'NO',
                initial: params.__worker_advanced,
            },
            // ------------- advanced --------------
            {
                name: 'WORKER_SCOPE',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'text' : null,
                message: 'Specify the Service Worker scope:',
                initial: params.WORKER_SCOPE,
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_CACHE_NAME',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'text' : null,
                message: 'Enter the Service Worker cache name:',
                initial: params.WORKER_CACHE_NAME,
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_FETCHING_STRATEGY',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'select' : null,
                message: 'Select the Service Worker fetching strategy:',
                choices: choices.worker_fetching_strategy,
                initial: initialGetIndex(choices.worker_fetching_strategy, params.WORKER_FETCHING_STRATEGY),
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_CACHING_STRATEGY',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'select' : null,
                message: 'Select the Service Worker caching strategy:',
                choices: choices.worker_cahing_strategy,
                initial: initialGetIndex(choices.worker_cahing_strategy, params.WORKER_CACHING_STRATEGY),
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_CACHING_LIST',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'list' : null,
                message: 'Specify files to cache (comma-separated):',
                initial: (params.WORKER_CACHING_LIST || []).join(', '),
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_SKIP_WAITING',
                type: (prev, answers) => answers.CREATE_WORKER && answers.__worker_advanced ? 'toggle' : null,
                message: 'Choose whether to skip Service Worker waiting state:',
                active: 'YES',
                inactive: 'NO',
                initial: params.WORKER_SKIP_WAITING,
            },
            // ------------- messaging --------------
            {
                name: 'WORKER_SUPPORT_MESSAGING',
                type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
                message: 'Support worker-clients post-messaging?',
                active: 'YES',
                inactive: 'NO',
                initial: params.WORKER_SUPPORT_MESSAGING,
            },
            // ------------- messaging --------------
            // ------------- messaging advanced --------------
            {
                name: '__messaging_advanced',
                type: (prev, answers) => answers.WORKER_SUPPORT_MESSAGING ? 'toggle' : null,
                message: 'Show advanced post-messaging options?',
                active: 'YES',
                inactive: 'NO',
                initial: params.__messaging_advanced,
            },
            // ------------- messaging advanced --------------
            {
                name: 'WORKER_MESSAGE_ROUTING_URL_PROPERTY',
                type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
                message: 'Enter the URL property name for message routing:',
                initial: params.WORKER_MESSAGE_ROUTING_URL_PROPERTY,
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_MESSAGE_SHOULD_RELAY_PROPERTY',
                type: (prev, answers) => answers.__messaging_advanced ? 'text' : null,
                message: 'Enter the property name for message relaying:',
                initial: params.WORKER_MESSAGE_SHOULD_RELAY_PROPERTY,
                validate: validateAs(['input']),
            },
            // ------------- notification --------------
            {
                name: 'WORKER_SUPPORT_NOTIFICATION',
                type: (prev, answers) => answers.CREATE_WORKER ? 'toggle' : null,
                message: 'Support push-notifications?',
                active: 'YES',
                inactive: 'NO',
                initial: params.WORKER_SUPPORT_NOTIFICATION,
            },
            // ------------- notification --------------
            {
                name: 'WORKER_PUSH_REGISTRATION_URL',
                type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
                message: 'Enter the URL for push notification subscription:',
                initial: params.WORKER_PUSH_REGISTRATION_URL,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'WORKER_PUSH_UNREGISTRATION_URL',
                type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
                message: 'Enter the URL for push notification unsubscription:',
                initial: params.WORKER_PUSH_UNREGISTRATION_URL,
                validate: validateAs(['input', 'important']),
            },
            {
                name: 'WORKER_PUSH_PUBLIC_KEY',
                type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'text' : null,
                message: 'Enter the Public Key for push notification subscription:',
                initial: params.WORKER_PUSH_PUBLIC_KEY,
                validate: validateAs(['input', 'important']),
            },
            // ------------- notification advanced --------------
            {
                name: '__notification_advanced',
                type: (prev, answers) => answers.WORKER_SUPPORT_NOTIFICATION ? 'toggle' : null,
                message: 'Show advanced push-notifications options?',
                active: 'YES',
                inactive: 'NO',
                initial: params.__notification_advanced,
            },
            // ------------- notification advanced --------------
            {
                name: 'WORKER_NOTIFICATION_ROUTING_URL_PROPERTY',
                type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
                message: 'Enter the URL property name for notification routing:',
                initial: params.WORKER_NOTIFICATION_ROUTING_URL_PROPERTY,
                validate: validateAs(['input']),
            },
            {
                name: 'WORKER_NOTIFICATION_TARGET_URL_PROPERTY',
                type: (prev, answers) => answers.__notification_advanced ? 'text' : null,
                message: 'Enter the URL property name for notification targeting:',
                initial: params.WORKER_NOTIFICATION_TARGET_URL_PROPERTY,
                validate: validateAs(['input']),
            },

        ];

        console.log('');
        console.log(Chalk.whiteBright(`Enter parameters:`));
        _merge(params, await Promptx(questions));

    } else {

        console.log('');
        console.log(Chalk.whiteBright(`Creating a build with the following params:`));
        printArgs(params);

    }

    if (!flags['CONFIG']) {
        DotJson.write(params, _paramsFile);
    }

    return params;
};
