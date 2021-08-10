
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import { DotJson, DotEnv, anyExists } from '@webqit/backpack/src/dotfiles/index.js';

/**
 * Reads entries from file.
 * 
 * @param object    flags
 * @param object    layout
 * 
 * @return object
 */
export async function read(flags = {}, layout = {}) {
    const ext = flags.env ? `.${flags.env}` : '';
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const envDir = Path.resolve(layout.ROOT || '');
    const fileName = ext => `${configDir}/variables${ext}.json`;
    const envFileName = ext => `${envDir}/.env${ext}`;
    const availableExt = anyExists([ext, '', '.example'], fileName);
    const availableEnvExt = anyExists([ext, '', '.example'], envFileName);
    const config = DotJson.read(fileName(availableExt));
    return _merge({
        autoload: true,
    }, config, {
        entries: DotEnv.read(envFileName(availableEnvExt)) || {},
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
    const ext = flags.env ? `.${flags.env}` : '';
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const envDir = Path.resolve(layout.ROOT || '');
    const fileName = ext => `${configDir}/variables${ext}.json`;
    const envFileName = ext => `${envDir}/.env${ext}`;

    const _config = {...config};
    DotEnv.write(_config.entries, envFileName(ext));
    
    delete _config.entries;
    DotJson.write(_config, fileName(ext));
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
