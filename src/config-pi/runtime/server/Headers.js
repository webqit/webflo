
/**
 * imports
 */
import { Dotfile } from '@webqit/backpack';

export default class Headers extends Dotfile {

    // Base name
    get name() {
        return 'headers';
    }

    // @desc
    static get ['@desc']() {
        return 'Automatic headers config.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            entries: [],
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        const CHOICES = this.merge({
            type: [
                {value: 'request', title: 'Request Header'},
                {value: 'response', title: 'Response Header'},
            ]
        }, choices, 'patch');
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'header',
                },
                initial: config.entries,
                schema: [
                    {
                        name: 'type',
                        type: 'text',
                        message: 'Choose header type',
                        validation: ['important'],
                        initial: function() { return this.indexOfInitial(CHOICES.type, this.value); },
                    },
                    {
                        name: 'url',
                        type: 'text',
                        message: 'Enter URL',
                        validation: ['important'],
                    },
                    {
                        name: 'name',
                        type: 'text',
                        message: 'Enter header name',
                        validation: ['important'],
                    },
                    {
                        name: 'value',
                        type: 'text',
                        message: 'Enter header value',
                        validation: ['important'],
                    },
                ],
            },
    
        ];
    }
}
