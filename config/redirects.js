
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _after from '@webqit/util/str/after.js';
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
    return DotJson.read(Path.join(setup.ROOT || '', './.webflo/config/redirects.json'));
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
    DotJson.write(config, Path.join(setup.ROOT || '', './.webflo/config/redirects.json'));
};

/**
 * @match
 */
export async function match(url, setup = {}) {
    if (!_isObject(url)) {
        url = Url.parse(url);
    }
    return ((await read(setup)).entries || []).reduce((match, rdr) => {
        if (match) {
            return match;
        }
        var matcher = Minimatch.Minimatch(rdr.to, {dot: true});
        var regex = matcher.makeRe();
        var rootMatch = url.pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
        if (rootMatch.endsWith(' ')) {
            var leaf = _after(url.pathname, rootMatch.trim());
            var [ target, query ] = rdr.to.split('?');
            // ---------------
            return {
                target: target + leaf,
                query: [(url.search || '').substr(1), query].filter(str => str).join('&'),
                code: rdr.code,
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

    // Choices
    const CHOICES = _merge({
        code: [
            {value: 302,},
            {value: 301,},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'entries',
            type: 'recursive',
            controls: {
                name: 'redirect',
            },
            initial: config.entries,
            questions: [
                {
                    name: 'from',
                    type: 'text',
                    message: 'Enter "from" URL',
                    validation: ['important'],
                },
                {
                    name: 'to',
                    type: 'text',
                    message: 'Enter "to" URL',
                    validation: ['important'],
                },
                {
                    name: 'code',
                    type: 'select',
                    choices: CHOICES.code,
                    message: 'Enter redirect code',
                    validation: ['number', 'important'],
                },
            ],
        },

    ];
};
