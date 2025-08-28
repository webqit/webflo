
/**
 * imports
 */
import { Dotfile } from '@webqit/backpack';

export default class Init extends Dotfile {

    // Base name
    get name() {
        return 'init';
    }

    // @desc
    static get ['@desc']() {
        return 'Webflo starter app config.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            template: 'web',
            install: true,
            git: true,
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'template',
                type: 'text',
                message: 'Enter the application template',
                initial: config.template,
                validation: ['important'],
            },
            {
                name: 'install',
                type: 'toggle',
                message: 'Run "npm install" after initialization?',
                active: 'YES',
                inactive: 'NO',
                initial: config.install,
            },
            {
                name: 'git',
                type: 'toggle',
                message: 'Run "git init" after initialization?',
                active: 'YES',
                inactive: 'NO',
                initial: config.git,
            },
        ];
    }
}
