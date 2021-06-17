
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _after from '@webqit/util/str/after.js';
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
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/headers${ext}.json`;
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
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const configFile = ext => `${configDir}/headers${ext}.json`;
    DotJson.write(config, ext ? configFile(ext) : configFile(''));
};

/**
 * @match
 */
export async function match(url, flags = {}, layout = {}) {
    if (!_isObject(url)) {
        url = Url.parse(url);
    }
    return ((await read(flags, layout)).entries || []).filter(header => {
        var regex = Micromatch.makeRe(header.url, {dot: true});
        var rootMatch = url.pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
        return rootMatch.endsWith(' ');
    });
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
                name: 'header',
            },
            initial: config.entries,
            questions: [
                {
                    name: 'url',
                    type: 'text',
                    message: 'Enter URL',
                    validation: ['important'],
                },
                {
                    name: 'name',
                    type: 'text',
                    message: 'Enter header name',
                    validation: ['important'],
                },
                {
                    name: 'value',
                    type: 'text',
                    message: 'Enter header value',
                    validation: ['important'],
                },
            ],
        },

    ];
};
