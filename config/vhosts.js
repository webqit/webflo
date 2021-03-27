
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
 * @param object    layout
 * 
 * @return object
 */
export async function read(layout = {}) {
    const config = DotJson.read(Path.join(layout.ROOT || '', './.webflo/config/vhosts.json'));
    return _merge({
        entries: [],
    }, config);
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
    DotJson.write(config, Path.join(layout.ROOT || '', './.webflo/config/vhosts.json'));
};

/**
 * @match
 */
export async function match(hostname, layout = {}) {
    if (_isObject(hostname)) {
        hostname = hostname.hostname;
    }
    return ((await read(layout)).entries || []).filter(vh => vh.host === hostname);
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
