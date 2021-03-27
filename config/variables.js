
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import * as DotEnv from '@webqit/backpack/src/dotfiles/DotEnv.js';

/**
 * Reads entries from file.
 * 
 * @param object    layout
 * 
 * @return object
 */
export async function read(layout = {}) {
    const config = DotJson.read(Path.join(layout.ROOT || '', './.webflo/config/variables.json'));
    return _merge({
        autoload: true,
    }, config, {
        entries: DotEnv.read(Path.join(layout.ROOT || '', './.env')) || {},
    });
};

/**
 * Writes entries to file.
 * 
 * @param object    config
 * @param object    layout
 * 
 * @return void
 */
export async function write(config, layout = {}) {
    const _config = {...config};
    DotEnv.write(_config.entries, Path.join(layout.ROOT || '', './.env'));
    delete _config.entries;
    DotJson.write(_config, Path.join(layout.ROOT || '', './.webflo/config/variables.json'));
};

/**
 * Configures entries.
 * 
 * @param object    config
 * @param object    CHOICES
 * @param object    layout
 * 
 * @return Array
 */
export async function questions(config, choices = {}, layout = {}) {

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
};
