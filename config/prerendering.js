
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
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
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webflo/config/`);
    const configFile = ext => `${configDir}/prerendering${ext}.json`;
    const config = DotJson.read(ext && Fs.existsSync(configFile(ext)) ? configFile(ext) : configFile(''));
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
    const ext = flags.dev ? '.dev' : (flags.live ? '.live' : '');
    const configDir = Path.join(layout.ROOT || ``, `./.webflo/config/`);
    const configFile = ext => `${configDir}/prerendering${ext}.json`;
    DotJson.write(config, ext ? configFile(ext) : configFile(''));
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
