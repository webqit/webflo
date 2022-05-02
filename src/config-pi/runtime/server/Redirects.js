
/**
 * imports
 */
import Url from 'url';
import { _merge } from '@webqit/util/obj/index.js';
import { _after } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import Micromatch from 'micromatch';
import Configurator from '../../../Configurator.js';

export default class Redirects extends Configurator {

    // Base name
    get name() {
        return 'redirects';
    }

    // @desc
    static get ['@desc']() {
        return 'Automatic redirects config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Match
    async match(url) {
        if (!_isObject(url)) {
            url = Url.parse(url);
        }
        return ((await this.read()).entries || []).reduce((match, rdr) => {
            if (match) {
                return match;
            }
            var regex = Micromatch.makeRe(rdr.from, {dot: true});
            var rootMatch = url.pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
            if (rootMatch.endsWith(' ')) {
                var leaf = _after(url.pathname, rootMatch.trim());
                var [ target, targetQuery ] = rdr.to.split('?');
                if (rdr.reuseQuery) {
                    targetQuery = [(url.search || '').substr(1), targetQuery].filter(str => str).join('&');
                }
                // ---------------
                return {
                    target: target + leaf + (targetQuery ? (leaf.endsWith('?') || leaf.endsWith('&') ? '' : (leaf.includes('?') ? '&' : '?')) + targetQuery : ''),
                    query: targetQuery,
                    code: rdr.code,
                };
            }
        }, null);
    }

    // Questions generator
    questions(config, choices = {}) {
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
                        name: 'reuseQuery',
                        type: 'toggle',
                        message: 'Reuse query parameters from matched URL in destination URL?',
                        active: 'YES',
                        inactive: 'NO',
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
    }
}
