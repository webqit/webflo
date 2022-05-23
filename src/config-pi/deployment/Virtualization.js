
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Virtualization extends Dotfile {

    // Base name
    get name() {
        return 'virtualization';
    }

    // @desc
    static get ['@desc']() {
        return 'Layout virtualization config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Match
    async match(hostname) {
        if (_isObject(hostname)) {
            hostname = hostname.hostname;
        }
        return ((await this.read()).entries || []).filter(vh => vh.host === hostname);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'vhost',
                },
                initial: config.entries,
                questions: [
                    {
                        name: 'host',
                        type: 'text',
                        message: 'Enter Host name',
                        validation: ['important'],
                    },
                    {
                        name: 'path',
                        type: 'text',
                        message: 'Enter local path',
                        validation: ['important'],
                    },
                ],
            },
    
        ];
    }
}
