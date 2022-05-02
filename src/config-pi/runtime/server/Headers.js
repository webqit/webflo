
/**
 * imports
 */
import Url from 'url';
import Micromatch from 'micromatch';
import { _merge } from '@webqit/util/obj/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import Configurator from '../../../Configurator.js';

export default class Headers extends Configurator {

    // Base name
    get name() {
        return 'headers';
    }

    // @desc
    static get ['@desc']() {
        return 'Automatic headers config.';
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
        return ((await this.read()).entries || []).filter(header => {
            var regex = Micromatch.makeRe(header.url, {dot: true});
            var rootMatch = url.pathname.split('/').filter(seg => seg).map(seg => seg.trim()).reduce((str, seg) => str.endsWith(' ') ? str : ((str = str + '/' + seg) && str.match(regex) ? str + ' ' : str), '');
            return rootMatch.endsWith(' ');
        });
    }

    // Questions generator
    questions(config, choices = {}) {
        const CHOICES = _merge({
            type: [
                {value: 'request', title: 'Request Header'},
                {value: 'response', title: 'Response Header'},
            ]
        }, choices);
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
                        name: 'type',
                        type: 'text',
                        message: 'Choose header type',
                        validation: ['important'],
                        initial: function() { return this.indexOfInitial(CHOICES.type, this.value); },
                    },
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
    }
}
