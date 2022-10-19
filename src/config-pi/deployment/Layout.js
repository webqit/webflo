
/**
 * imports
 */
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
            ROOT: process.cwd(),
            PUBLIC_DIR: './public',
            SERVER_DIR: './server',
            CLIENT_DIR: './client',
            WORKER_DIR: './worker',
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
