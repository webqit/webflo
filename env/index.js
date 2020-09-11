
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Lexer from '@onephrase/util/str/Lexer.js';
import _wrapped from '@onephrase/util/str/wrapped.js';
import _isObject from '@onephrase/util/js/isObject.js';

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
        return parse(Fs.readFileSync(file).toString());
    }
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
    return Fs.writeFileSync(file, stringify(vars));
};

/**
 * Parses a string into object vars.
 * 
 * @param string str - String declarations or file.
 * 
 * @return object
 */
export function parse(str) {
    var parsed = {};
    var tokens = Lexer.split(str, ["\r\n"]);
    tokens.forEach(token => {
        var [ key, val ] = Lexer.split(token, ["="]).map(t => t + '');
        if (val && _wrapped(val, '{', '}')) {
            val = JSON.parse(val);
        }
        parsed[key] = val;
    });
    return parsed;
};

/**
 * Stringifies object vars back into a string.
 * 
 * @param object obj
 * 
 * @return string
 */
export function stringify(obj) {
    return Object.keys(obj).reduce((tokens, key) => {
        tokens.push(key + (!key.startsWith('#') ? '=' : '') + (_isObject(obj[key]) ? JSON.stringify(obj[key]) : obj[key] || ''));
        return tokens;
    }, []).join("\r\n");
};
