
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import { DotJson, anyExists } from '@webqit/backpack/src/dotfiles/index.js';
import Micromatch from 'micromatch';

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
    const fileName = ext => `${configDir}/prerendering${ext}.json`;
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
    const fileName = ext => `${configDir}/prerendering${ext}.json`;
    DotJson.write(config, fileName(ext));
};

/**
 * @match
 */
export async function match(url, flags = {}, layout = {}) {
    var pathname = url;
    if (_isObject(url)) {
        pathname = url.pathname;
    }
    return ((await read(flags, layout)).entries || []).reduce((match, prerend) => {
        if (match) {
            return match;
        }
        var regex = Micromatch.makeRe(prerend.page, {dot: true});
        var rootMatch = pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
        if (rootMatch.endsWith(' ')) {
            return {
                url: prerend.page,
            };
        }
    }, null);
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
                name: 'page',
            },
            initial: config.entries,
            questions: [
                {
                    name: 'page',
                    type: 'text',
                    message: 'Page URL',
                    validation: ['important'],
                },
            ],
        },

    ];
};
