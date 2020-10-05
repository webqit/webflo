
/**
 * imports
 */
import Chalk from 'chalk';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import * as DotEnv from '@onephrase/util/src/DotEnv.js';
import Promptx from '@onephrase/util/cli/Promptx.js';

/**
 * ----------
 * Adds new directives
 * ----------
 */
export function add(flags, title, file, type = 'variable') {
    var Driver = file.endsWith('.json') ? DotJson : DotEnv;
    var directives = Driver.read(file);
    Object.keys(flags).forEach(k => {
        if (typeof flags[k] !== 'bool') {
            directives[k.toLowerCase()] = flags[k];
            console.log(Chalk.greenBright(`> ${title.toUpperCase()} ${type} added: ${k}`));
        }
    });
    // Serialize
    Driver.write(directives, file);
};

/**
 * ----------
 * Removes directives
 * ----------
 */
export function del(_flags, title, file, type = 'variable') {
    if (!_flags[0]) {
        console.log(Chalk.yellow(`Please enter a ${title.toUpperCase()} ${type}!`));
    } else {
        var Driver = file.endsWith('.json') ? DotJson : DotEnv;
        var directives = Driver.read(file);
        _flags.forEach(name => {
            delete directives[name.toLowerCase()];
            console.log(Chalk.greenBright(`> ${title.toUpperCase()} ${type} deleted: ${name}`));
        });
        // Serialize
        Driver.write(directives, file);
    }
};

/**
 * ----------
 * Lists directives
 * ----------
 */
export async function list(_flags, title, file, type = 'variable') {
    var Driver = file.endsWith('.json') ? DotJson : DotEnv;
    var directives = Driver.read(file);

    var action;
    if (_flags[0] === '--d' || _flags[0] === '--del') {
        action = 'delete';
    }

    var types = type.endsWith('y') ? type.substr(0, type.length - 1) + 'ies' : type + 's';
    console.log(Chalk.yellowBright(Chalk.bold(`${title.toUpperCase()} ${types}:`)));
    if (!action) {

        Object.keys(directives).forEach(k => {
            console.log(`${Chalk.greenBright('>')} ${k}: ${Chalk.greenBright(directives[k])}`);
        });

    } else {

        var _list = Object.keys(directives).map(name => {
            return {value: name, description: directives[name]};
        });
        await Promptx([{
            name: 'selection',
            type: 'multiselect',
            message: 'Select ' + types + ' to ' + action,
            choices: _list,
        }, {
            name: 'confirmation',
            type: prev => prev.length ? 'toggle' : null,
            message: action.substr(0,1).toUpperCase() + action.substr(1) + ' selected ' + types + '?',
            active: 'YES',
            inactive: 'NO',
        }]).then(answers => {

            console.log('');
            return !answers.confirmation ? null : Promise.all(answers.selection.map(name => {
                if (action === 'delete') {
                    return del([name], title, file, type);
                }
            }));

        });

    }

};