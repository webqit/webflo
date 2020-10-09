
/**
 * imports
 */
import Url from 'url';
import Path from 'path';
import Chalk from 'chalk';
import Clui from 'clui';
import Webpack from 'webpack';
import * as DotJs from '@onephrase/util/src/DotJs.js';
import buildRoutes from './buildRoutes.js'

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default async function(params) {

    // Consistent forward slashing
    const forwardSlash = str => str.replace(/\\/g, '/');
    let importURL = forwardSlash(Url.fileURLToPath(import.meta.url));
    var importDir = Path.dirname(importURL);
    var clientDirSplit = params.CLIENT_DIR.replace(/\\/g, '/').split('/');
    let spnnr;

    // -------------------
    // Create the Service Worker file
    // -------------------

    if (params.CREATE_WORKER) {

        var workerBundlingConfig = params.WORKER_BUNDLING || {};
        if (!workerBundlingConfig.entry) {
            workerBundlingConfig.entry = clientDirSplit.join('/') + '/worker.js';
        }
        if (!workerBundlingConfig.output) {
            workerBundlingConfig.output = {
                filename: 'worker.js',
                path: params.PUBLIC_DIR,
            };
        }

        var workerBuild = {
            imports: {},
            code: [],
        };

        // >> Import the Navigator Client file
        var navigatorWorker = Path.dirname(importURL) + '/Worker.js';
        workerBuild.imports[navigatorWorker] = 'Worker';

        console.log('');
        console.log(Chalk.bgYellow(Chalk.black(' SERVICE WORKER BUILD ')));
        // >> Routes mapping
        buildRoutes(params.WORKER_DIR, workerBuild, 'Worker-Side Routing:');

        // >> Params
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Params`);
        workerBuild.code.push(`const params = {`);
        Object.keys(params).forEach(name => {
            if (name.startsWith('WORKER_') && name !== 'WORKER_DIR') {
                workerBuild.code.push(`   ${name.replace('WORKER_', '')}: ${['boolean', 'number'].includes(typeof params[name]) ? params[name] : `'${params[name]}'`},`);
            }
        });
        workerBuild.code.push(`   ROUTES: routes,`);
        workerBuild.code.push(`};`);

        // >> instantiation
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Instantiation`);
        workerBuild.code.push(`Worker.call(null, params);`);
        
        // >> Write to file...
        spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the Service Worker file: ') + Chalk.greenBright(workerBundlingConfig.entry));
        spnnr.start();

        // Write
        DotJs.write(workerBuild, workerBundlingConfig.entry, 'Service Worker File');
        
        spnnr.stop();
        console.log(Chalk.bold('Service Worker file:'));
        console.log('> ' + Chalk.greenBright(workerBundlingConfig.entry));

    }

    // -------------------
    // Create the Client file
    // -------------------

    var clientBundlingConfig = params.CLIENT_BUNDLING || {};
    if (!clientBundlingConfig.entry) {
        clientBundlingConfig.entry = clientDirSplit.join('/') + '/app.js';
    }
    if (!clientBundlingConfig.output) {
        clientBundlingConfig.output = {
            filename: 'app.js',
            path: params.PUBLIC_DIR,
        };
    }

    var clientBuild = {
        imports: {},
        code: [],
    };

    console.log('');
    console.log(Chalk.bgYellow(Chalk.black(' CLIENT BUILD ')));
    // >> Routes mapping
    buildRoutes(params.CLIENT_DIR, clientBuild, 'Client-Side Routing:');

    // >> Import the Navigator Client file
    clientBuild.imports[importDir + '/Client.js'] = 'Client';

    // >> Client Params
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Client Params`);
    clientBuild.code.push(`const params = {`);
    Object.keys(params).forEach(name => {
        if (name.startsWith('CLIENT_') && name !== 'CLIENT_DIR') {
            clientBuild.code.push(`   ${name.replace('CLIENT_', '')}: typeof ${name} !== 'undefined' ? ${name} : ${['boolean', 'number'].includes(typeof params[name]) ? params[name] : `'${params[name]}'`},`);
        }
    });
    clientBuild.code.push(`   ROUTES: routes,`);
    clientBuild.code.push(`};`);

    // >> Client Instantiation
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Client Instantiation`);
    clientBuild.code.push(`Client.call(null, params);`);

    // Service Worker registration code?
    if (params.CREATE_WORKER) {
        if (params.WORKER_SUPPORT_PUSH) {
            clientBuild.imports[importDir + '/Push.js'] = 'Push';
        }
        clientBuild.code.push(...[
            ``,
            `// >> Service Worker Registration`,
            `if ('serviceWorker' in navigator) {`,
            `    window.addEventListener('load', () => {`,
            `        navigator.serviceWorker.register('/${workerBundlingConfig.output.filename}', {scope: '${params.WORKER_SCOPE}'}).then(async registration => {`,
            `            console.log('Service worker registered.');`,
            `            await /*SUPPORT_PUSH*/${params.WORKER_SUPPORT_PUSH} ? new Push(registration, {`,
            `                REGISTRATION_URL: '${params.WORKER_PUSH_REGISTRATION_URL}',`,
            `                UNREGISTRATION_URL: '${params.WORKER_PUSH_UNREGISTRATION_URL}',`,
            `                PUBLIC_KEY: '${params.WORKER_PUSH_PUBLIC_KEY}',`,
            `            }) : null;`,
            `        });`,
            `    });`,
            `}`,
            ``,
            `/**`,
            `navigator.serviceWorker.addEventListener('message', event => {`,
            `    if (event.data.isNotificationTargetEvent) {`,
            `        // NotificationClick event for this client`,
            `        console.log('NotificationClick event for this client', event.data);`,
            `    } else if (event.data.isNotificationUntargetEvent) {`,
            `        // NotificationClose event for this client`,
            `        console.log('NotificationClose event for this client', event.data);`,
            `    } else if (event.data.isMessageRelay) {`,
            `        // Message from other clients`,
            `        console.log('Message from other clients', event.data);`,
            `    }`,
            `});`,
            `*/`,
            ``,
        ]);
    }
    
    // >> Write to file...
    spnnr = new Clui.Spinner(Chalk.whiteBright('Writing the client entry file: ') + Chalk.greenBright(clientBundlingConfig.entry));
    spnnr.start();

    // Write
    DotJs.write(clientBuild, clientBundlingConfig.entry, 'Client Build File');
        
    spnnr.stop();
    console.log(Chalk.bold('Client Build file:'));
    console.log('> ' + Chalk.greenBright(clientBundlingConfig.entry));

    // -------------------
    // Run webpack
    // -------------------
    
    if (params.CLIENT_BUNDLING !== false || params.WORKER_BUNDLING !== false) {
        console.log('');
        console.log(Chalk.bgYellow(Chalk.black(' BUNDLES ')));
    }
    if (params.WORKER_BUNDLING !== false) {
        await createBundle(workerBundlingConfig, 'Bundling the Service Worker Build file');
    }
    if (params.CLIENT_BUNDLING !== false) {
        await createBundle(clientBundlingConfig, 'Bundling the Client Build file');
    }

};

/**
 * Creates a bundle using webpack
 * 
 * @param {object} config 
 * @param {string} desc 
 * 
 * @return void
 */
const createBundle = (config, desc) => {

    return new Promise(resolve => {
        console.log('');
        var spnnr = new Clui.Spinner(Chalk.whiteBright(desc) + Chalk.blueBright('...'));
        console.log(Chalk.blueBright('> ') + Chalk.bgGray(Chalk.black('FROM')) + ': ' + Chalk.greenBright(config.entry));
        console.log(Chalk.blueBright('> ') + Chalk.bgGray(Chalk.black('TO')) + ': ' + Chalk.greenBright(config.output.path + '/' + config.output.filename));
        console.log('');
        spnnr.start();

        // Run
        var compiler = Webpack(config);
        compiler.run((err, stats) => {
            spnnr.stop();
            if (err) {
                console.log(Chalk.yellowBright('Errors!'));
                console.log(err);
            }
            console.log(stats.toString({
                colors: true,
            }));

            resolve();
        });
    });


};