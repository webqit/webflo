
/**
 * imports
 */
import Path from 'path';
import { _merge } from '@webqit/util/obj/index.js';
import Configurator from '../../Configurator.js';

export default class Server extends Configurator {

    // Base name
    get name() {
        return 'server';
    }

    // @desc
    static get ['@desc']() {
        return 'Server Runtime config.';
    }

    // Defaults merger
    withDefaults(config) {
        return _merge(true, {
            port: process.env.port || 3000,
            https: {
                port: 0,
                keyfile: '',
                certfile: '',
                certdoms: ['*'],
                force: false,
            },
            process: {
                name: Path.basename(process.cwd()),
                errfile: '',
                outfile: '',
                exec_mode: 'fork',
                autorestart: true,
                merge_logs: false,
            },
            force_www: '',
            shared: false,
        }, config);
    }

    // Questions generator
    questions(config, choices = {}) {
        // Choices
        const CHOICES = _merge({
            exec_mode: [
                {value: 'fork',},
                {value: 'cluster',},
            ],
            force_www: [
                {value: '', title: 'do nothing'},
                {value: 'add',},
                {value: 'remove',},
            ],
        }, choices);
        // Questions
        return [
            {
                name: 'port',
                type: 'number',
                message: 'Enter port number',
                initial: config.port,
                validation: ['important'],
            },
            {
                name: 'https',
                initial: config.https,
                controls: {
                    name: 'https',
                },
                questions: [
                    {
                        name: 'port',
                        type: 'number',
                        message: 'Enter HTTPS port number',
                        validation: ['important'],
                    },
                    {
                        name: 'keyfile',
                        type: 'text',
                        message: 'Enter SSL KEY file',
                        validation: ['important'],
                    },
                    {
                        name: 'certfile',
                        type: 'text',
                        message: 'Enter SSL CERT file',
                        validation: ['important'],
                    },
                    {
                        name: 'certdoms',
                        type: 'list',
                        message: 'Enter the CERT domains (comma-separated)',
                        validation: ['important'],
                    },
                    {
                        name: 'force',
                        type: 'toggle',
                        message: 'Force HTTPS?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                ],
            },
            {
                name: 'process',
                initial: config.process,
                controls: {
                    name: 'background process',
                },
                questions: [
                    {
                        name: 'name',
                        type: 'text',
                        message: 'Enter a name for process',
                        validation: ['important'],
                    },
                    {
                        name: 'errfile',
                        type: 'text',
                        message: 'Enter path to error file',
                        validation: ['important'],
                    },
                    {
                        name: 'outfile',
                        type: 'text',
                        message: 'Enter path to output file',
                        validation: ['important'],
                    },
                    {
                        name: 'exec_mode',
                        type: 'select',
                        message: 'Select exec mode',
                        choices: CHOICES.exec_mode,
                        validation: ['important'],
                    },
                    {
                        name: 'autorestart',
                        type: 'toggle',
                        message: 'Server autorestart on crash?',
                        active: 'YES',
                        inactive: 'NO',
                        initial: config.autorestart,
                    },
                    {
                        name: 'merge_logs',
                        type: 'toggle',
                        message: 'Server merge logs?',
                        active: 'YES',
                        inactive: 'NO',
                    },
                ],
            },
            {
                name: 'force_www',
                type: 'select',
                message: 'Force add/remove "www" on hostname?',
                choices: CHOICES.force_www,
                initial: this.indexOfInitial(CHOICES.force_www, config.force_www),
            },
            {
                name: 'shared',
                type: 'toggle',
                message: 'Shared server?',
                active: 'YES',
                inactive: 'NO',
                initial: config.shared,
            },
        ];
    }
}
