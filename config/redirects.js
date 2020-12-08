
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
 * Reads REDIRECTS from file.
 * 
 * @param object    params
 * 
 * @return object
 */
export async function read(params = {}) {
    return DotJson.read(Path.join(params.ROOT || '', './.webflo/config/redirects.json'));
};

/**
 * Writes REDIRECTS to file.
 * 
 * @param object    config
 * @param object    params
 * 
 * @return void
 */
export async function write(config, params = {}) {
    DotJson.write(config, Path.join(params.ROOT || '', './.webflo/config/redirects.json'));
};

/**
 * @match
 */
export async function match(url, params = {}) {
    if (!_isObject(url)) {
        url = Url.parse(url);
    }
    return ((await read(params)).REDIRECTS || []).reduce((match, rdr) => {
        if (match) {
            return match;
        }
        var matcher = Minimatch.Minimatch(rdr.FROM, {dot: true});
        var regex = matcher.makeRe();
        var rootMatch = url.pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
        if (rootMatch.endsWith(' ')) {
            var leaf = _after(url.pathname, rootMatch.trim());
            var [ target, query ] = rdr.TO.split('?');
            // ---------------
            return {
                target: target + leaf,
                query: [(url.search || '').substr(1), query].filter(str => str).join('&'),
                code: rdr.CODE,
            };
        }
    }, null);
};

/**
 * Configures REDIRECTS.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

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
            name: 'REDIRECTS',
            type: 'recursive',
            controls: {
                name: 'redirect',
            },
            initial: config.REDIRECTS,
            questions: [
                {
                    name: 'FROM',
                    type: 'text',
                    message: 'Enter "from" URL',
                    validation: ['important'],
                },
                {
                    name: 'TO',
                    type: 'text',
                    message: 'Enter "to" URL',
                    validation: ['important'],
                },
                {
                    name: 'CODE',
                    type: 'select',
                    choices: CHOICES.code,
                    message: 'Enter redirect code',
                    validation: ['number', 'important'],
                },
            ],
        },

    ];
};
