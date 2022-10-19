
/**
 * imports
 */
import Url from 'url';
import { _merge } from '@webqit/util/obj/index.js';
import { _after } from '@webqit/util/str/index.js';
import { _isObject, _isNumeric } from '@webqit/util/js/index.js';
import { Dotfile } from '@webqit/backpack';

export default class Redirects extends Dotfile {

    // Base name
    get name() {
        return 'redirects';
    }

    // @desc
    static get ['@desc']() {
        return 'Automatic redirects config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Choices
        const CHOICES = _merge({
            code: [
                {value: 302,},
                {value: 301,},
            ],
        }, choices);
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'redirect',
                },
                initial: config.entries,
                schema: [
                    {
                        name: 'from',
                        type: 'text',
                        message: 'Enter "from" URL',
                        validation: ['important'],
                    },
                    {
                        name: 'to',
                        type: 'text',
                        message: 'Enter "to" URL',
                        validation: ['important'],
                    },
                    {
                        name: 'code',
                        type: 'select',
                        choices: CHOICES.code,
                        message: 'Enter redirect code',
                        validation: ['number'],
                    },
                ],
            },

        ];
    }
}
