
/**
 * imports
 */
import Fs from 'fs';
import Path, { dirname } from 'path';

/**
 * Reads contents of the .env file as an object.
 * 
 * @param string file
 * 
 * @return object
 */
export function read(file) {
    file = Path.resolve(file);
    // Parse
    if (Fs.existsSync(file)) {
        return JSON.parse(Fs.readFileSync(file).toString() || '{}');
    }
    return {};
};

/**
 * Creates a .env file from an object.
 * 
 * @param object vars
 * @param string file
 * 
 * @return bool
 */
export function write(vars, file) {
    file = Path.resolve(file);
    var dir = Path.dirname(file);
    if (!Fs.existsSync(dir)) {
        Fs.mkdirSync(dir, {recursive:true});
    }
    return Fs.writeFileSync(file, JSON.stringify(vars, null, 4));
};
