
/**
 * imports
 */
import parseArgs from '@webqit/backpack/src/cli/parseArgs.js';
import Ui from '@webqit/backpack/src/cli/Ui.js';
import Runtime from './Runtime.js';

const { flags } = parseArgs(process.argv);
Runtime.call(null, Ui, flags);    
