
/**
 * imports
 */
import parseArgs from '@webqit/backpack/src/cli/parseArgs.js';
import Ui from '@webqit/backpack/src/cli/Ui.js';
import * as server from '../../config/server.js';
import Server from './Server.js';

const { command, keywords, flags, options, ellipsis } = parseArgs(process.argv);

server.read({}).then(config => {
    config.ROOT = process.cwd();
    const runtimeMode = flags.prod ? 'prod' : (flags.dev ? 'dev' : config.RUNTIME_MODE);
    if (config.RUNTIME_MODE !== runtimeMode) {
        config.RUNTIME_MODE = runtimeMode;
    }
    Server.call(null, Ui, config);    
});
