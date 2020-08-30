
/**
 * imports
 */
import Fs from 'fs';
import { execStart } from './index.js';

if (process.argv[2]) {
    if (!Fs.existsSync(process.argv[2])) {
        throw new Error('Implied (JSON) params file "' + process.argv[2] + '" does not exist.');
    }
    var params = JSON.parse(Fs.readFileSync(process.argv[2]));
    execStart(params);
} else {
    throw new Error('Script must be called with a (JSON) params file.');
}