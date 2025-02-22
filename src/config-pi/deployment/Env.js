
/**
 * imports
 */
import { Dotfile } from '@webqit/backpack';

export default class Env extends Dotfile {

    // Base name
    get name() {
        return 'env';
    }

    // @desc
    static get ['@desc']() {
        return 'Environmental variable mappings.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            mappings: {}
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'mappings',
                type: 'recursive',
                controls: {
                    name: 'variable mappings',
                    combomode: true,
                },
                initial: config.mappings,
                schema: [
                    {
                        name: 'name',
                        type: 'text',
                        message: 'Name',
                        validation: ['important'],
                    },
                    {
                        name: 'value',
                        type: 'text',
                        message: 'Value',
                        validation: ['important'],
                    },
                ],
            }
        ];
    }
}
