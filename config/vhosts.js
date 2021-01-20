
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads entries from file.
 * 
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    return DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/vhosts.json'));
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
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/vhosts.json'));
};

/**
 * @match
 */
export async function match(hostname, setup = {}) {
    if (_isObject(hostname)) {
        hostname = hostname.hostname;
    }
    return ((await read(setup)).entries || []).filter(vh => vh.host === hostname);
};

/**
 * Configures entries.
 * 
 * @param object    config
 * @param object    choices
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
