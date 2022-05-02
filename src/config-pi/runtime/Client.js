
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
            support_oohtml: true,
            support_service_worker: true,
            worker_scope: '/',
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Questions
        return [
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
        ];
    }
}
