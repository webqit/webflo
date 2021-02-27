
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
 * @param object    setup
 * 
 * @return object
 */
export async function read(setup = {}) {
    const config = DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/prerendering.json'));
    return _merge({
        entries: [],
    }, config);
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
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/prerendering.json'));
};

/**
 * @match
 */
export async function match(url, setup = {}) {
    var pathname = url;
    if (_isObject(url)) {
        pathname = url.pathname;
    }
    return ((await read(setup)).entries || []).reduce((match, prerend) => {
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
