
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _isObject from '@webqit/util/js/isObject.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import Minimatch from 'minimatch';

/**
 * Reads PRERENDERING from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    const config = DotJson.read(Path.join(params.ROOT || '', './.webflo/config/prerendering.json'));
    return _merge({
        PRERENDERING: [{
            PAGE: '',
        }],
    }, config);
};

/**
 * Writes PRERENDERING to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/prerendering.json'));
};

/**
 * @match
 */
export async function match(url, params = {}) {
    var pathname = url;
    if (_isObject(url)) {
        pathname = url.pathname;
    }
    return ((await read(params)).PRERENDERING || []).reduce((match, prerend) => {
        if (match) {
            return match;
        }
        var matcher = Minimatch.Minimatch(prerend.PAGE, {dot: true});
        var regex = matcher.makeRe();
        var rootMatch = pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
        if (rootMatch.endsWith(' ')) {
            return {
                url: prerend.PAGE,
            };
        }
    }, null);
};

/**
 * Configures PRERENDERING.
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
            name: 'PRERENDERING',
            type: 'recursive',
            controls: {
                name: 'page',
            },
            initial: config.PRERENDERING,
            questions: [
                {
                    name: 'PAGE',
                    type: 'text',
                    message: 'Page URL',
                    validation: ['important'],
                },
            ],
        },

    ];
};
