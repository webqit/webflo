
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads RUNTIME from file.
 * 
 * @param object    flags
 * @param object    layout
 * 
 * @return object
 */
 export async function read(flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webflo/config/`);
    const configFile = ext => `${configDir}/server${ext}.json`;
    const config = DotJson.read(ext && Fs.existsSync(configFile(ext)) ? configFile(ext) : configFile(''));
    return _merge({
        port: process.env.port || 3000,
        https: {
            port: 0,
            keyfile: '',
            certfile: '',
            certdoms: ['*'],
            force: false,
        },
        process: {
            name: Path.basename(process.cwd()),
            errfile: '',
            outfile: '',
            exec_mode: 'fork',
            autorestart: true,
            merge_logs: false,
        },
        force_www: '',
        shared: false,
    }, config);
};

/**
 * Writes RUNTIME to file.
 * 
 * @param object    config
 * @param object    flags
 * @param object    layout
 * 
 * @return void
 */
 export async function write(config, flags = {}, layout = {}) {
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webflo/config/`);
    const configFile = ext => `${configDir}/server${ext}.json`;
    DotJson.write(config, ext ? configFile(ext) : configFile(''));
};

/**
 * Configures RUNTIME.
 * 
 * @param object    config
 * @param object    choices
 * @param object    layout
 * 
 * @return Array
 */
export async function questions(config, choices = {}, layout = {}) {

    // Choices
    const CHOICES = _merge({
        exec_mode: [
            {value: 'fork',},
            {value: 'cluster',},
        ],
        force_www: [
            {value: '', title: 'do nothing'},
            {value: 'add',},
            {value: 'remove',},
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
                    name: 'certdoms',
                    type: 'list',
                    message: 'Enter the CERT domains (comma-separated)',
                    validation: ['important'],
                    format: val => val || '',
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
                    name: 'autorestart',
                    type: 'toggle',
                    message: 'Server autorestart on crash?',
                    active: 'YES',
                    inactive: 'NO',
                    initial: config.autorestart,
                },
                {
                    name: 'merge_logs',
                    type: 'toggle',
                    message: 'Server merge logs?',
                    active: 'YES',
                    inactive: 'NO',
                },
            ],
        },
        {
            name: 'force_www',
            type: 'select',
            message: 'Force add/remove "www" on hostname?',
            choices: CHOICES.force_www,
            initial: initialGetIndex(CHOICES.force_www, config.force_www),
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
