
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
        return 'Environmental variables config.';
    }

    // isEnv
    get isEnv() {
        return true;
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            autoload: true,
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
                    name: 'variable',
                    combomode: true,
                },
                initial: config.entries,
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
            },
            {
                name: 'autoload',
                type: 'toggle',
                message: 'Choose whether to autoload variables into "process.env"',
                active: 'YES',
                inactive: 'NO',
                initial: config.autoload,
            },
        ];
    }
}
