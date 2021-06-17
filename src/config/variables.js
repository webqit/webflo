
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import * as DotEnv from '@webqit/backpack/src/dotfiles/DotEnv.js';

/**
 * Reads entries from file.
 * 
 * @param object    flags
 * @param object    layout
 * 
 * @return object
 */
 export async function read(flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/variables${ext}.json`;
    const config = DotJson.read(ext && Fs.existsSync(configFile(ext)) ? configFile(ext) : configFile(''));
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
 * @param object    flags
 * @param object    layout
 * 
 * @return void
 */
 export async function write(config, flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/variables${ext}.json`;

    const _config = {...config};
    DotEnv.write(_config.entries, Path.join(layout.ROOT || '', './.env'));
    
    delete _config.entries;
    DotJson.write(_config, ext ? configFile(ext) : configFile(''));
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
