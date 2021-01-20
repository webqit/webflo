
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotEnv from '@webqit/backpack/src/dotfiles/DotEnv.js';

/**
 * Reads entries from file.
 * 
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    return {entries: DotEnv.read(Path.join(setup.ROOT || '', './.env')),};
};

/**
 * Writes entries to file.
 * 
 * @param object    config
 * @param object    setup
 * 
 * @return void
 */
export async function write(config, setup = {}) {
    DotEnv.write(config.entries, Path.join(setup.ROOT || '', './.env'));
};

/**
 * Configures entries.
 * 
 * @param object    config
 * @param object    CHOICES
 * @param object    setup
 * 
 * @return Array
 */
export async function questions(config, choices = {}, setup = {}) {

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

    ];
};
