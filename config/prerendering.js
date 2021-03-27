
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import Minimatch from 'minimatch';

/**
 * Reads entries from file.
 * 
 * @param object    layout
 * 
 * @return object
 */
export async function read(layout = {}) {
    const config = DotJson.read(Path.join(layout.ROOT || '', './.webflo/config/prerendering.json'));
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
    DotJson.write(config, Path.join(layout.ROOT || '', './.webflo/config/prerendering.json'));
};

/**
 * @match
 */
export async function match(url, layout = {}) {
    var pathname = url;
    if (_isObject(url)) {
        pathname = url.pathname;
    }
    return ((await read(layout)).entries || []).reduce((match, prerend) => {
        if (match) {
            return match;
        }
        var matcher = Minimatch.Minimatch(prerend.page, {dot: true});
        var regex = matcher.makeRe();
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
