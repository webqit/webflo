
/**
 * imports
 */
import { _merge } from '@webqit/util/obj/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import Micromatch from 'micromatch';
import Configurator from '../../Configurator.js';

export default class Ssg extends Configurator {

    // Base name
    get name() {
        return 'ssg';
    }

    // @desc
    static get ['@desc']() {
        return 'Server-Side Generation (SSG) config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            entries: [],
        }, config);
    }

    // Match
    async match(url) {
        var pathname = url;
        if (_isObject(url)) {
            pathname = url.pathname;
        }
        return ((await this.read()).entries || []).reduce((match, prerend) => {
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
    }

    // Questions generator
    questions(config, choices = {}) {
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
    }
}
