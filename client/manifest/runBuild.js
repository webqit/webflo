
/**
 * imports
 */
import Chalk from 'chalk';
import Clui from 'clui';
import * as DotJson from '@onephrase/util/src/DotJson.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    // Consistent forward slashing
    var publicDirSplit = params.PUBLIC_DIR.replace(/\\/g, '/').split('/');
    let spnnr;

    // -------------------
    // Create the manifest file
    // -------------------

    var manifest = {};

    Object.keys(params).forEach(name => {
        if (name.startsWith('MANIFEST_')) {
            manifest[name.replace('MANIFEST_', '').toLowerCase()] = params[name];
        }
    });
    
    // >> Write to file...
    var manifestFile = publicDirSplit.join('/') + '/manifest.json';

    console.log('');
    spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the manifest file: ') + Chalk.greenBright(manifestFile));
    spnnr.start();

    // Write
    DotJson.write(manifest, manifestFile);
    
    spnnr.stop();
    console.log(Chalk.bold('Manifest file:'));
    console.log('> ' + Chalk.greenBright(manifestFile));

};
