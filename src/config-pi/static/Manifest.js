
/**
 * imports
 */
import Path from 'path';
import { _all } from '@webqit/util/arr/index.js';
import { _merge } from '@webqit/util/obj/index.js';
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before, _after } from '@webqit/util/str/index.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import Configurator from '../../Configurator.js';

export default class Manifest extends Configurator {

    // Base name
    get name() {
        return 'manifest';
    }

    // @desc
    static get ['@desc']() {
        return 'Application Manifest config.';
    }

    // Config dir
    get configDir() {
        return Path.join(this.cx.CWD || ``, this.cx.layout.PUBLIC_DIR || '');
    }

    // Defaults merger
    withDefaults(config) {
        const pkg = this.cx.PKG || {};
        return _merge(true, {
            // -----------------
            name: pkg.value,
            short_name: pkg.value,
            description: pkg.description,
            categories: pkg.keywords,
            theme_color: 'transparent',
            background_color: 'transparent',
            icons: [],
            display: 'browser',
            orientation: 'any',
            // advanced
            screenshots: [],
            shortcuts: [],
            scope: '/',
            start_url: '/',
            lang: 'en-us',
            dir: 'ltr',
            related_applications: '',
            prefer_related_applications: false,
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Choices hash...
        const CHOICES = _merge({
            display: [
                {value: 'browser',},
                {value: 'fullscreen',},
                {value: 'standalone',}, 
                {value: 'minimal-ui',},
            ],
            orientation: [
                {value: 'any',},
                {value: 'natural',},
                {value: '::::::::::::::::', disabled: true,},
                {value: 'landscape',},
                {value: 'landscape-primary',},
                {value: 'landscape-secondary',},
                {value: '::::::::::::::::', disabled: true,},
                {value: 'portrait',},
                {value: 'portrait-primary',},
                {value: 'portrait-secondary',},
            ],
        }, choices);

        // Gets index...
        const getSize = src => Path.basename(src).split(/[_\.\-]/g).reduce((size, chunk) => size || (_all(chunk.split('x'), c => _isNumeric(c)) ? chunk : ''), null);
        const getMime = src => extensions[Path.extname(src)];
        // extensions
        const extensions = {
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.jpeg': 'image/jpeg',
            '.ico': 'image/ico',
        };

        // Questions
        return [
            {
                name: 'name',
                type: 'text',
                message: 'Enter the application name',
                initial: config.name,
                validation: ['important'],
            },
            {
                name: 'short_name',
                type: 'text',
                message: 'Enter the application short name',
                initial: prev => config.short_name || prev,
                validation: ['important'],
            },
            {
                name: 'description',
                type: 'text',
                message: 'Enter the application description',
                initial: config.description,
                validation: ['important'],
            },
            {
                name: 'categories',
                type: 'list',
                message: 'Specify applications categories (comma-separated)',
                initial: (config.categories || []).join(', '),
            },
            {
                name: 'theme_color',
                type: 'text',
                message: 'Enter the application theme color',
                initial: config.theme_color,
            },
            {
                name: 'background_color',
                type: 'text',
                message: 'Enter the application background color',
                initial: config.background_color,
            },
            {
                name: 'icons',
                type: 'recursive',
                initial: config.icons,
                controls: {
                    name: 'icon',
                },
                questions: [
                    {
                        name: 'src',
                        type: 'text',
                        message: 'Enter icon URL',
                        validation: ['important'],
                    },
                    {
                        name: 'type',
                        type: 'text',
                        message: 'Enter icon MIME type',
                        initial: prev => getMime(prev),
                        validation: ['important'],
                    },
                    {
                        name: 'sizes',
                        type: 'text',
                        message: 'Enter icon sizes',
                        initial: (prev, answers) => getSize(answers.src),
                        validation: ['important'],
                    },
                ],
            },
            {
                name: 'display',
                type: 'select',
                message: 'Enter the application display mode',
                choices: CHOICES.display,
                initial: initialGetIndex(CHOICES.display, config.display),
            },
            {
                name: 'orientation',
                type: 'select',
                message: 'Enter the application orientation mode',
                choices: CHOICES.orientation,
                initial: initialGetIndex(CHOICES.orientation, config.orientation),
            },
            // ------------- advanced --------------
            {
                name: '__advanced',
                type: 'toggle',
                message: 'Show advanced options?',
                active: 'YES',
                inactive: 'NO',
                initial: config.__advanced,
                exclude: true,
            },
            // ------------- advanced --------------
            {
                name: 'screenshots',
                type: (prev, answers) => answers.__advanced ? 'recursive' : null,
                initial: config.screenshots,
                controls: {
                    name: 'screenshot',
                },
                questions: [
                    {
                        name: 'src',
                        type: 'text',
                        message: 'Enter screenshot URL',
                        validation: ['important'],
                    },
                    {
                        name: 'type',
                        type: 'text',
                        message: 'Enter screenshot MIME type',
                        initial: prev => getMime(prev),
                        validation: ['important'],
                    },
                    {
                        name: 'sizes',
                        type: 'text',
                        message: 'Enter screenshot sizes',
                        initial: (prev, answers) => getSize(answers.src),
                        validation: ['important'],
                    },
                ],
            },
            {
                name: 'shortcuts',
                type: (prev, answers) => answers.__advanced ? 'recursive' : null,
                initial: config.shortcuts,
                controls: {
                    name: 'shortcut',
                },
                questions: [
                    {
                        name: 'name',
                        type: 'text',
                        message: 'Enter shortcut name',
                        validation: ['important'],
                    },
                    {
                        name: 'short_name',
                        type: 'text',
                        message: 'Enter shortcut short name',
                        validation: ['important'],
                    },
                    {
                        name: 'description',
                        type: 'text',
                        message: 'Enter shortcut description',
                        validation: ['important'],
                    },
                    {
                        name: 'url',
                        type: 'text',
                        message: 'Enter shortcut URL',
                        validation: ['important'],
                    },
                    {
                        name: 'icons',
                        type: 'recursive',
                        controls: {
                            name: 'shortcut icon',
                        },
                        questions: [
                            {
                                name: 'src',
                                type: 'text',
                                message: 'Enter icon URL',
                                validation: ['important'],
                            },
                            {
                                name: 'type',
                                type: 'text',
                                message: 'Enter icon MIME type',
                                initial: prev => getMime(prev),
                                validation: ['important'],
                            },
                            {
                                name: 'sizes',
                                type: 'text',
                                message: 'Enter icon sizes',
                                initial: (prev, answers) => getSize(answers.src),
                                validation: ['important'],
                            },
                        ],
                    },
                ],
            },
            {
                name: 'scope',
                type: (prev, answers) => answers.__advanced ? 'text' : null,
                message: 'Specify the manifest scope',
                initial: config.scope,
            },
            {
                name: 'start_url',
                type: (prev, answers) => answers.__advanced ? 'text' : null,
                message: 'Specify the application start URL',
                initial: config.start_url,
            },
            {
                name: 'lang',
                type: (prev, answers) => answers.__advanced ? 'text' : null,
                message: 'Specify the application language',
                initial: config.lang,
            },
            {
                name: 'dir',
                type: (prev, answers) => answers.__advanced ? 'text' : null,
                message: 'Specify the application writing mode',
                initial: config.dir,
            },
            {
                name: 'related_applications',
                type: (prev, answers) => answers.__advanced ? 'list' : null,
                message: 'Specify related applications (comma-separated)',
                initial: (config.related_applications || []).join(', '),
            },
            {
                name: 'prefer_related_applications',
                type: (prev, answers) => answers.related_applications ? 'toggle' : null,
                message: 'Specify whether to "prefer" related applications',
                active: 'YES',
                inactive: 'NO',
                initial: config.prefer_related_applications,
            },

        ];
    }
}
