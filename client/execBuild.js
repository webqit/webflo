
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Chalk from 'chalk';
import Clui from 'clui';
import webpack from 'webpack';
import _beforeLast from '@onephrase/util/str/beforeLast.js';
import DotJs from '../util/DotJs.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    // -------------------
    // Helper functions
    // -------------------

    // Consistent forward slashing
    const forwardSlash = str => str.replace(/\\/g, '/');
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

    let spnnr;

    // -------------------
    // Register routes
    // -------------------

    var clientDefinition = {
        imports: {},
        code: [],
    };

    var importURL = forwardSlash(import.meta.url.replace('file:///', ''));
    // >> Import the Navigator Client file
    var navigatorClient = Path.dirname(importURL) + '/modules/Client.js';
    clientDefinition.imports[navigatorClient] = 'Client';

    // >> Routes mapping
    clientDefinition.code.push(`// >> Route definition`);
    clientDefinition.code.push(`const routes = {};`);

    console.log('');
    console.log(Chalk.bold(Chalk.yellowBright('Routes definition:')));
    var appDirSplit = params.appDir.replace(/\\/g, '/').split('/');
    var clientDefinitionFile = appDirSplit.join('/') + '/app.js';
    
    var indexCount = 0;
    walk(params.appDir, (file, ext) => {
        //relativePath = relativePath.replace(/\\/g, '/');
        if (file.replace(/\\/g, '/').endsWith('/index.js')) {
            var relativePath = Path.relative(params.appDir, file).replace(/\\/g, '/');
            // Import code
            var routeName = 'index' + (++ indexCount);
            clientDefinition.imports['./' + relativePath] = '* as ' + routeName;
            // Definition code
            var routePath = _beforeLast('/' + relativePath, '/index.js');
            clientDefinition.code.push(`routes['${routePath || '/'}'] = ${routeName};`);
            // Show
            console.log(Chalk.greenBright(' .' + relativePath));
        }
    });

    clientDefinition.code.push(`
// >> Parameters gathering
const params = typeof Navigator_Params !== 'undefined' ? {...Navigator_Params} : {};
params.routes = routes;`
    );

    clientDefinition.code.push(`
// >> Application instantiation
Client(params);`
    );

    // -------------------
    // Create the entry file
    // -------------------
    

    console.log('');

    spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the client entry file: ') + Chalk.greenBright(clientDefinitionFile));
    spnnr.start();

    // Write
    DotJs(clientDefinition, clientDefinitionFile, 'App bootstrap file');

    // -------------------
    // Run webpack
    // -------------------
    
    if (params.bundle !== false) {
        // Config
        var webpackConfig = params.webpack || {};
        if (!webpackConfig.entry) {
            webpackConfig.entry = clientDefinitionFile;
        }
        if (!webpackConfig.output) {
            webpackConfig.output = {
                filename: 'app.js',
                path: params.publicDir,
            };
        }

        spnnr.stop();
        spnnr = new Clui.Spinner(Chalk.whiteBright('Bundling files') + Chalk.blueBright('...'));
        spnnr.start();

        // Run
        var compiler = webpack(webpackConfig);
        compiler.run((err, stats) => {
            spnnr.stop();
            console.log(Chalk.bold(Chalk.yellowBright('Bundle details:')));
            if (err) {
                console.log(Chalk.yellowBright('Errors!'));
                console.log(err);
            }
            console.log(stats.toString({
                colors: true,
            }));
        });
    }

};
