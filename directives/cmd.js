
/**
 * imports
 */
import Chalk from 'chalk';
import * as DotJson from '../util/DotJson.js';
import * as DotEnv from '../util/DotEnv.js';

/**
 * ----------
 * Adds new directives
 * ----------
 */
export function add(flags, title, file, type = 'variable') {
    var added = [];
    var Driver = file.endsWith('.json') ? DotJson : DotEnv;
    var directives = Driver.read(file);
    Object.keys(flags).forEach(k => {
        if (typeof flags[k] !== 'bool') {
            directives[k] = flags[k];
            added.push(k);
        }
    });
    // Serialize
    Driver.write(directives, file);
    console.log(Chalk.yellowBright(`${title.toUpperCase()} ${type + (added.length > 1 ? 's' : '')} added: (${added.length}) ${added.join(' ')}`));
};

/**
 * ----------
 * Removes directives
 * ----------
 */
export function del(_flags, title, file, type = 'variable') {
    if (!_flags[0]) {
        console.log(Chalk.yellowBright(`Please enter a ${title.toUpperCase()} ${type}!`));
    } else {
        var Driver = file.endsWith('.json') ? DotJson : DotEnv;
        var directives = Driver.read(file);
        _flags.forEach(name => {
            delete directives[name];
        });
        // Serialize
        Driver.write(directives, file);
        console.log(Chalk.yellowBright(`${title.toUpperCase()} ${type + (_flags.length > 1 ? 's' : '')} deleted: (${_flags.length}) ${_flags.join(' ')}`));
    }
};

/**
 * ----------
 * Lists directives
 * ----------
 */
export function list(title, file, type = 'variable') {
    console.log('');
    console.log(Chalk.yellowBright(`${title.toUpperCase()} ${type}s:`));
    var Driver = file.endsWith('.json') ? DotJson : DotEnv;
    var directives = Driver.read(file);
    Object.keys(directives).forEach(k => {
        console.log(`> ${k}: ${Chalk.greenBright(directives[k])}`);
    });
};