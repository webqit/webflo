import { Dotfile } from '@webqit/backpack';

export default class Layout extends Dotfile {

    // Base name
    get name() {
        return 'layout';
    }

    // @desc
    static get ['@desc']() {
        return 'Project layout config.';
    }

    // Defaults merger
    withDefaults(config) {
        return this.merge({
            PUBLIC_DIR: './public',
            VIEWS_DIR: './app',
            SERVER_DIR: './app',
            CLIENT_DIR: './app',
            WORKER_DIR: './app',
        }, config, 'patch');
    }

    // Questions generator
    getSchema(config, choices = {}) {
        // Questions
        return [
            {
                name: 'PUBLIC_DIR',
                type: 'text',
                message: 'Enter the application\'s public directory',
                initial: config.PUBLIC_DIR,
                validation: ['important'],
            },
            {
                name: 'VIEWS_DIR',
                type: 'text',
                message: 'Enter the directory for the application\'s view files (templates)',
                initial: config.VIEWS_DIR,
                validation: ['important'],
            },
            {
                name: 'SERVER_DIR',
                type: 'text',
                message: 'Enter the directory for the application\'s server-side route handlers',
                initial: config.SERVER_DIR,
                validation: ['important'],
            },
            {
                name: 'CLIENT_DIR',
                type: 'text',
                message: 'Enter the directory for the application\'s client-side route handlers',
                initial: config.CLIENT_DIR,
                validation: ['important'],
            },
            {
                name: 'WORKER_DIR',
                type: 'text',
                message: 'Enter the directory for the application\'s offline route handlers',
                initial: config.WORKER_DIR,
                validation: ['important'],
            },
        ];
    }
}
