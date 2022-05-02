
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import Configurator from '../../Configurator.js';

export default class Env extends Configurator {

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
        return _merge({
            autoload: true,
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
                    name: 'variable',
                    combomode: true,
                },
                initial: config.entries,
                questions: [
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
