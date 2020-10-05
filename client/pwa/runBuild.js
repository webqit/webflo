
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import Clui from 'clui';
import * as DotJs from '@onephrase/util/src/DotJs.js';
import * as DotJson from '@onephrase/util/src/DotJson.js';
import buildRoutes from '../buildRoutes.js'

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    // Consistent forward slashing
    const forwardSlash = str => str.replace(/\\/g, '/');
    let importURL = forwardSlash(Url.fileURLToPath(import.meta.url));
    var publicDirSplit = params.PUBLIC_DIR.replace(/\\/g, '/').split('/');
    let spnnr;

    // -------------------
    // Create the manifest file
    // -------------------

    if (params.CREATE_MANIFEST) {

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
    }

    // -------------------
    // Create the Service Worker file
    // -------------------

    if (params.CREATE_WORKER) {

        var build = {
            imports: {},
            code: [],
        };

        // >> Import the Navigator Client file
        var navigatorWorker = Path.dirname(importURL) + '/Worker.js';
        build.imports[navigatorWorker] = 'Worker';

        // >> Routes mapping
        buildRoutes(params.WORKER_DIR, build, 'Worker routing:');

        // >> Params
        build.code.push(``);
        build.code.push(`// >> Worker Params`);
        build.code.push(`const params = {`);
        Object.keys(params).forEach(name => {
            if (name.startsWith('WORKER_') && name !== 'WORKER_DIR') {
                build.code.push(`   ${name.replace('WORKER_', '')}: '${params[name]}',`);
            }
        });
        build.code.push(`   ROUTES: routes,`);
        build.code.push(`};`);

        // >> instantiation
        build.code.push(``);
        build.code.push(`// >> Worker Instantiation`);
        build.code.push(`Worker.call(params);`);
        
        // >> Write to file...
        var buildFile = publicDirSplit.join('/') + '/worker.js';

        console.log('');
        spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the Service Worker file: ') + Chalk.greenBright(buildFile));
        spnnr.start();

        // Write
        DotJs.write(build, buildFile, 'Service Worker File');
        
        spnnr.stop();
        console.log(Chalk.bold('Service Worker file:'));
        console.log('> ' + Chalk.greenBright(buildFile));

    }

};
