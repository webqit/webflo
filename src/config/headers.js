
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import _after from '@webqit/util/str/after.js';
import _isObject from '@webqit/util/js/isObject.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import { DotJson, anyExists } from '@webqit/backpack/src/dotfiles/index.js';
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
    const ext = flags.env ? `.${flags.env}` : '';
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const fileName = ext => `${configDir}/headers${ext}.json`;
    const availableExt = anyExists([ext, '', '.example'], fileName);
    const config = DotJson.read(fileName(availableExt));
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
    const ext = flags.env ? `.${flags.env}` : '';
    const configDir = Path.join(layout.ROOT || ``, `./.webqit/webflo/config/`);
    const fileName = ext => `${configDir}/headers${ext}.json`;
    DotJson.write(config, fileName(ext));
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
                    initial: function() { return initialGetIndex(CHOICES.type, this.value); },
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
};
