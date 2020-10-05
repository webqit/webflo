
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import Clui from 'clui';
import Webpack from 'webpack';
import * as DotJs from '@onephrase/util/src/DotJs.js';
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
    let spnnr;

    // -------------------
    // Create the Client file
    // -------------------

    var build = {
        imports: {},
        code: [],
    };

    // >> Routes mapping
    buildRoutes(params.CLIENT_DIR, build, 'Routing structure:');

    // >> Import the Navigator Client file
    var navigatorClient = Path.dirname(importURL) + '/Client.js';
    build.imports[navigatorClient] = 'Client';

    // >> instantiation
    build.code.push(``);
    build.code.push(`// >> Client Params`);
    build.code.push(`const params = {`);
    Object.keys(params).forEach(name => {
        if (name.startsWith('CLIENT_') && name !== 'CLIENT_DIR') {
            build.code.push(`   ${name.replace('CLIENT_', '')}: typeof ${name} !== 'undefined' ? ${name} : '${params[name]}',`);
        }
    });
    build.code.push(`   ROUTES: routes,`);
    build.code.push(`};`);

    // >> instantiation
    build.code.push(``);
    build.code.push(`// >> Client Instantiation`);
    build.code.push(`Client.call(params);`);
    
    var clientDirSplit = params.CLIENT_DIR.replace(/\\/g, '/').split('/');
    var buildFile = clientDirSplit.join('/') + '/app.js';

    console.log('');
    spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the client entry file: ') + Chalk.greenBright(buildFile));
    spnnr.start();

    // Write
    DotJs.write(build, buildFile, 'Client Build File');

    // -------------------
    // Run webpack
    // -------------------
    
    if (params.BUNDLE !== false) {
        // Config
        var webpackConfig = params.WEBPACK || {};
        if (!webpackConfig.entry) {
            webpackConfig.entry = buildFile;
        }
        if (!webpackConfig.output) {
            webpackConfig.output = {
                filename: 'app.js',
                path: params.PUBLIC_DIR,
            };
        }

        spnnr.stop();
        spnnr = new Clui.Spinner(Chalk.whiteBright('Bundling files') + Chalk.blueBright('...'));
        spnnr.start();

        // Run
        var compiler = Webpack(webpackConfig);
        compiler.run((err, stats) => {
            spnnr.stop();
            console.log(Chalk.bold('Bundle details:'));
            console.log('------');
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
