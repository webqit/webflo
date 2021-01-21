
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads RUNTIME from file.
 * 
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    const config = DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/server.json'));
    return _merge({
        port: process.env.port || 3000,
        https: {
            port: 0,
            keyfile: '',
            certfile: '',
            force: true,
        },
        process: {
            name: Path.basename(process.cwd()),
            errfile: '',
            outfile: '',
            merge_logs: true,
            exec_mode: 'fork',
            autorestart: true,
        },
        shared: false,
    }, config);
};

/**
 * Writes RUNTIME to file.
 * 
 * @param object    config
 * @param object    setup
 * 
 * @return void
 */
export async function write(config, setup = {}) {
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/server.json'));
};

/**
 * Configures RUNTIME.
 * 
 * @param object    config
 * @param object    choices
 * @param object    setup
 * 
 * @return Array
 */
export async function questions(config, choices = {}, setup = {}) {

    // Choices
    const CHOICES = _merge({
        exec_mode: [
            {value: 'fork',},
            {value: 'cluster',},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'port',
            type: 'number',
            message: 'Enter port number',
            initial: config.port,
            validation: ['important'],
        },
        {
            name: 'https',
            initial: config.https,
            controls: {
                name: 'https',
            },
            questions: [
                {
                    name: 'port',
                    type: 'number',
                    message: 'Enter HTTPS port number',
                    validation: ['important'],
                },
                {
                    name: 'keyfile',
                    type: 'text',
                    message: 'Enter SSL KEY file',
                    validation: ['important'],
                },
                {
                    name: 'certfile',
                    type: 'text',
                    message: 'Enter SSL CERT file',
                    validation: ['important'],
                },
                {
                    name: 'force',
                    type: 'toggle',
                    message: 'Force HTTPS?',
                    active: 'YES',
                    inactive: 'NO',
                },
            ],
        },
        {
            name: 'process',
            initial: config.process,
            controls: {
                name: 'background process',
            },
            questions: [
                {
                    name: 'name',
                    type: 'text',
                    message: 'Enter a name for process',
                    validation: ['important'],
                },
                {
                    name: 'errfile',
                    type: 'text',
                    message: 'Enter path to error file',
                    validation: ['important'],
                },
                {
                    name: 'outfile',
                    type: 'text',
                    message: 'Enter path to output file',
                    validation: ['important'],
                },
                {
                    name: 'exec_mode',
                    type: 'select',
                    message: 'Select exec mode',
                    choices: CHOICES.exec_mode,
                    validation: ['important'],
                },
                {
                    name: 'merge_logs',
                    type: 'toggle',
                    message: 'Server merge logs?',
                    active: 'YES',
                    inactive: 'NO',
                },
                {
                    name: 'autorestart',
                    type: 'toggle',
                    message: 'Server autorestart on crash?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.autorestart,
                },
            ],
        },
        {
            name: 'shared',
            type: 'toggle',
            message: 'Shared server?',
            active: 'YES',
            inactive: 'NO',
            initial: config.shared,
        },
    ];
};
