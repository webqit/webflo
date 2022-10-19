
/**
 * imports
 */
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
        return this.merge({
            entries: [],
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'entries',
                type: 'recursive',
                controls: {
                    name: 'page',
                },
                initial: config.entries,
                schema: [
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
