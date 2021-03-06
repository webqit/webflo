
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads PROJECT from file.
 * 
 * @param object    flags
 * @param object    defaults
 * 
 * @return object
 */
export async function read(flags, defaults = {}) {
    const config = DotJson.read(Path.join(defaults.ROOT || '', './.webqit/webflo/config/setup.json'));
    return _merge({
        ROOT: defaults.ROOT || process.cwd(),
        PUBLIC_DIR: './public',
        SERVER_DIR: './server',
        CLIENT_DIR: './client',
        WORKER_DIR: './worker',
    }, config);
};

/**
 * Writes PROJECT to file.
 * 
 * @param object    config
 * @param object    flags
 * @param object    defaults
 * 
 * @return void
 */
export async function write(config, flags = {}, defaults = {}) {
    DotJson.write(config, Path.join(defaults.ROOT || '', './.webqit/webflo/config/setup.json'));
};

/**
 * Configures PROJECT.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Questions
    return [
        {
            name: 'PUBLIC_DIR',
            type: 'text',
            message: 'Enter the application\'s public directory',
            initial: config.PUBLIC_DIR,
            validation: ['important'],
        },
        {
            name: 'SERVER_DIR',
            type: 'text',
            message: 'Enter the directory for the application\'s server-side route handlers',
            initial: config.SERVER_DIR,
            validation: ['important'],
        },
        {
            name: 'CLIENT_DIR',
            type: 'text',
            message: 'Enter the directory for the application\'s client-side route handlers',
            initial: config.CLIENT_DIR,
            validation: ['important'],
        },
        {
            name: 'WORKER_DIR',
            type: 'text',
            message: 'Enter the directory for the application\'s offline route handlers',
            initial: config.WORKER_DIR,
            validation: ['important'],
        },
    ];
};
