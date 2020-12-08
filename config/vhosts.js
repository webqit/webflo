
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads VHOSTS from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    return DotJson.read(Path.join(params.ROOT || '', './.webflo/config/vhosts.json'));
};

/**
 * Writes VHOSTS to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/vhosts.json'));
};

/**
 * @match
 */
export async function match(hostname, params = {}) {
    if (_isObject(hostname)) {
        hostname = hostname.hostname;
    }
    return ((await read(params)).VHOSTS || []).filter(vh => vh.HOST === hostname);
};

/**
 * Configures VHOSTS.
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
            name: 'VHOSTS',
            type: 'recursive',
            controls: {
                name: 'vhost',
            },
            initial: config.VHOSTS,
            questions: [
                {
                    name: 'HOST',
                    type: 'text',
                    message: 'Enter Host name',
                    validation: ['important'],
                },
                {
                    name: 'PATH',
                    type: 'text',
                    message: 'Enter local path',
                    validation: ['important'],
                },
            ],
        },

    ];
};
