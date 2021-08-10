
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import { DotJson, anyExists } from '@webqit/backpack/src/dotfiles/index.js';

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
    const fileName = ext => `${configDir}/vhosts${ext}.json`;
    const availableExt = anyExists([ext, '', '.example'], fileName);
    const config = DotJson.read(fileName(availableExt));
    return _merge({
        entries: [],
    }, config);
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
    const fileName = ext => `${configDir}/vhosts${ext}.json`;
    DotJson.write(config, fileName(ext));
};

/**
 * @match
 */
export async function match(hostname, flags = {}, layout = {}) {
    if (_isObject(hostname)) {
        hostname = hostname.hostname;
    }
    return ((await read(flags, layout)).entries || []).filter(vh => vh.host === hostname);
};

/**
 * Configures entries.
 * 
 * @param object    config
 * @param object    choices
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
                name: 'vhost',
            },
            initial: config.entries,
            questions: [
                {
                    name: 'host',
                    type: 'text',
                    message: 'Enter Host name',
                    validation: ['important'],
                },
                {
                    name: 'path',
                    type: 'text',
                    message: 'Enter local path',
                    validation: ['important'],
                },
            ],
        },

    ];
};
