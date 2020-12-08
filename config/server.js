
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads SERVER from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    const config = DotJson.read(Path.join(params.ROOT || '', './.webflo/config/server.json'));
    return _merge({
        PORT: process.env.PORT || 4200,
        PUBLIC_DIR: './public',
        SERVER_DIR: './server',
        RUNTIME_MODE: 'development',
        RUNTIME_NAME: Path.basename(process.cwd()),
        AUTO_RESTART: true,
        VHOSTS_MODE: false,
        SHOW_REQUEST_LOG: true,
    }, config);
};

/**
 * Writes SERVER to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/server.json'));
};

/**
 * Configures SERVER.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Choices
    const CHOICES = _merge({
        runtime_mode: [
            {value: 'development',},
            {value: 'production',},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'PORT',
            type: 'number',
            message: 'Enter PORT number',
            initial: config.PORT,
            validation: ['important'],
        },
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
            message: 'Enter the application\'s server-side routing directory',
            initial: config.SERVER_DIR,
            validation: ['important'],
        },
        {
            name: 'RUNTIME_MODE',
            type: 'select',
            message: 'Enter the application runtime mode',
            choices: CHOICES.runtime_mode,
            initial: initialGetIndex(CHOICES.runtime_mode, config.RUNTIME_MODE),
        },
        {
            name: 'RUNTIME_NAME',
            type: (prev, answers) => answers.RUNTIME_MODE === 'production' ? 'text' : null,
            message: 'Enter a name for this runtime',
            initial: config.RUNTIME_NAME,
            validation: ['important'],
        },
        {
            name: 'AUTO_RESTART',
            type: (prev, answers) => answers.RUNTIME_MODE === 'production' ? 'toggle' : null,
            message: 'Should server auto-restart on crash?',
            active: 'YES',
            inactive: 'NO',
            initial: config.AUTO_RESTART,
        },
        // ------------- advanced --------------
        {
            name: '__advanced',
            type: 'toggle',
            message: 'Show advanced options?',
            active: 'YES',
            inactive: 'NO',
            initial: config.__advanced,
        },
        // ------------- advanced --------------
        {
            name: 'VHOSTS_MODE',
            type: (prev, answers) => answers.__advanced ? 'toggle' : null,
            message: 'Run in multi-hosts mode?',
            active: 'YES',
            inactive: 'NO',
            initial: config.VHOSTS_MODE,
        },
        {
            name: 'SHOW_REQUEST_LOG',
            type: (prev, answers) => answers.__advanced ? 'toggle' : null,
            message: 'Show request log?',
            active: 'YES',
            inactive: 'NO',
            initial: config.SHOW_REQUEST_LOG,
        },
    ];
};
