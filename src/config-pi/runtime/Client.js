
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
import Configurator from '../../Configurator.js';

export default class Client extends Configurator {

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
            support_oohtml: true,
            support_service_worker: true,
            worker_scope: '/',
            worker_filename: 'worker.js',
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Questions
        return [
            {
                name: 'bundle_filename',
                type: 'text',
                message: 'Specify the bundle filename',
                initial: config.bundle_filename,
            },
            {
                name: 'support_oohtml',
                type: 'toggle',
                message: 'Support rendering with OOHTML? (Adds OOHTML to your app\'s bundle.)',
                active: 'YES',
                inactive: 'NO',
                initial: config.support_oohtml,
            },
            {
                name: 'support_service_worker',
                type: 'toggle',
                message: 'Support Service Worker?',
                active: 'YES',
                inactive: 'NO',
                initial: config.support_service_worker,
            },
            {
                name: 'worker_scope',
                type: (prev, answers) => answers.support_service_worker ? 'text' : null,
                message: 'Specify the Service Worker scope',
                initial: config.worker_scope,
            },
            {
                name: 'worker_filename',
                type: (prev, answers) => answers.support_service_worker ? 'text' : null,
                message: 'Specify the Service Worker filename',
                initial: config.worker_filename,
            },
        ];
    }
}
