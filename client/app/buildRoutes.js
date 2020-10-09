
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Chalk from 'chalk';
import _beforeLast from '@onephrase/util/str/beforeLast.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(entry, build, desc) {
    
    // -------------------
    // Helper functions
    // -------------------

    // Directory walking
    const walk = (dir, callback) => {
        Fs.readdirSync(dir).forEach(f => {
            let resource = Path.join(dir, f);
            if (Fs.statSync(resource).isDirectory()) {
                walk(resource, callback);
            } else {
                var ext = Path.extname(resource) || '';
                callback(resource, ext);
            }
        });
    };

    console.log('');
    console.log(Chalk.bold(desc));

    // >> Routes mapping
    build.code.push(`// >> ` + desc);
    build.code.push(`const routes = {};`);

    var indexCount = 0;
    if (entry && Fs.existsSync(entry)) {
        walk(entry, (file, ext) => {
            //relativePath = relativePath.replace(/\\/g, '/');
            if (file.replace(/\\/g, '/').endsWith('/index.js')) {
                var relativePath = Path.relative(entry, file).replace(/\\/g, '/');
                // Import code
                var routeName = 'index' + (++ indexCount);
                build.imports['./' + relativePath] = '* as ' + routeName;
                // Definition code
                var routePath = _beforeLast('/' + relativePath, '/index.js');
                build.code.push(`routes['${routePath || '/'}'] = ${routeName};`);
                // Show
                console.log(Chalk.greenBright('> ./' + relativePath));
            }
        });
    }
    if (!indexCount) {
        console.log(Chalk.greenBright('> (none)'));
    }

};
