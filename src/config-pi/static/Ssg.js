
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Ssg extends Dotfile {

    // Base name
    get name() {
        return 'ssg';
    }

    // @desc
    static get ['@desc']() {
        return 'Server-Side Generation (SSG) config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'page',
                },
                initial: config.entries,
                questions: [
                    {
                        name: 'url',
                        type: 'text',
                        message: 'Page URL',
                        validation: ['important'],
                    },
                ],
            },
    
        ];
    }
}
