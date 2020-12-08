
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotEnv from '@webqit/backpack/src/dotfiles/DotEnv.js';

/**
 * Reads VARIABLES from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    return {VARIABLES: DotEnv.read(Path.join(params.ROOT || '', './.env')),};
};

/**
 * Writes VARIABLES to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotEnv.write(config.VARIABLES, Path.join(params.ROOT || '', './.env'));
};

/**
 * Configures VARIABLES.
 * 
 * @param object    config
 * @param object    CHOICES
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Questions
    return [
        {
            name: 'VARIABLES',
            type: 'recursive',
            controls: {
                name: 'variable',
                combomode: true,
            },
            initial: config.VARIABLES,
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

    ];
};
