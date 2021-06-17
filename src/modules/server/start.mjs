
/**
 * imports
 */
import parseArgs from '@webqit/backpack/src/cli/parseArgs.js';
import Ui from '@webqit/backpack/src/cli/Ui.js';
import Server from './Server.js';

const { flags } = parseArgs(process.argv);
Server.call(null, Ui, flags);    
