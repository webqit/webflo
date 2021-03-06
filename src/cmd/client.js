
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Webpack from 'webpack';
import _isEmpty from '@webqit/util/js/isEmpty.js';
import _beforeLast from '@webqit/util/str/beforeLast.js';
import * as DotJs from '@webqit/backpack/src/dotfiles/DotJs.js';
import * as client from '../config/client.js'


/**
 * @description
 */
export const desc = {
    build: 'Creates the application Client Build.',
};

/**
 * @build
 */
export async function build(Ui, flags = {}, layout = {}) {
    const config = await client.read(flags, layout);
    // Consistent forward slashing
    const forwardSlash = str => str.replace(/\\/g, '/');
    var clientModulesDir = forwardSlash(Url.fileURLToPath(Path.join(import.meta.url, '../../modules/client')));
    var clientDirSplit = Path.resolve(layout.CLIENT_DIR).replace(/\\/g, '/').split('/');
    var clientParams = config.client || {};
    var workerParams = config.worker || {};
    var createWorker = !_isEmpty(workerParams);
    var waiting;

    // -------------------
    // Create the Service Worker file
    // -------------------

    if (createWorker) {

        var workerBundlingConfig = workerParams.bundling || {};
        if (!workerBundlingConfig.intermediate) {
            workerBundlingConfig.intermediate = clientDirSplit.join('/') + '/worker.js';
        }
        if (!workerBundlingConfig.output) {
            workerBundlingConfig.output = {
                filename: 'worker.js',
                path: Path.resolve(layout.PUBLIC_DIR),
            };
        }

        var workerBuild = {
            imports: {},
            code: [],
        };

        // >> Import the Webflo Client file
        var navigatorWorker = clientModulesDir + '/Worker.js';
        workerBuild.imports[navigatorWorker] = 'Worker';

        Ui.log('');
        Ui.title(`SERVICE WORKER BUILD`);
        // >> Routes mapping
        buildRoutes(Ui, Path.resolve(layout.WORKER_DIR), workerBuild, 'Worker-Side Routing:');

        // >> Params
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Params`);
        workerBuild.code.push(`const params = {`);
        Object.keys(workerParams).forEach(name => {
            if (name !== 'bundling') {
                workerBuild.code.push(`   ${name}: ${['boolean', 'number'].includes(typeof workerParams[name]) ? workerParams[name] : (Array.isArray(workerParams[name]) ? (!workerParams[name].length ? `[]` : `['${workerParams[name].join(`', '`)}']`) : `'${workerParams[name]}'`)},`);
            }
        });
        workerBuild.code.push(`};`);

        // >> instantiation
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Instantiation`);
        workerBuild.code.push(`Worker.call(null, layout, params);`);
        
        // >> Write to file...
        waiting = Ui.waiting(Ui.f`Writing the Service Worker file: ${workerBundlingConfig.intermediate}`);
        waiting.start();

        // Write
        DotJs.write(workerBuild, workerBundlingConfig.intermediate, 'Service Worker File');
        
        waiting.stop();
        Ui.info(Ui.f`Service Worker file: ${workerBundlingConfig.intermediate}`);

    }

    // -------------------
    // Create the Client file
    // -------------------

    var clientBundlingConfig = config.bundling || {};
    if (!clientBundlingConfig.intermediate) {
        clientBundlingConfig.intermediate = clientDirSplit.join('/') + '/bundle.js';
    }
    if (!clientBundlingConfig.output) {
        clientBundlingConfig.output = {
            filename: 'bundle.js',
            path: Path.resolve(layout.PUBLIC_DIR),
        };
    }

    var clientBuild = {
        imports: {},
        code: [],
    };

    // >> Import the Webflo Client file
    clientBuild.imports[clientModulesDir + '/Client.js'] = 'Client';

    Ui.log('');
    Ui.title(`CLIENT BUILD`);
    // >> Routes mapping
    buildRoutes(Ui, Path.resolve(layout.CLIENT_DIR), clientBuild, 'Client-Side Routing:');

    // >> Client Params
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Client Params`);
    clientBuild.code.push(`const params = {`);
    clientBuild.code.push(`};`);

    // >> Client Instantiation
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Client Instantiation`);
    clientBuild.code.push(`Client.call(null, layout, params);`);

    // Service Worker registration code?
    if (createWorker) {
        if (workerParams.support_push) {
            clientBuild.imports[clientModulesDir + '/Push.js'] = 'Push';
        }
        clientBuild.code.push(...[
            ``,
            `// >> Service Worker Registration`,
            `if ('serviceWorker' in navigator) {`,
            `    window.addEventListener('load', () => {`,
            `        navigator.serviceWorker.register('/${workerBundlingConfig.output.filename}', {scope: '${workerParams.scope}'}).then(async registration => {`,
            `            console.log('Service worker registered.');`,
            `            await /*SUPPORT_PUSH*/${workerParams.support_push} ? new Push(registration, {`,
            `                registration_url: '${workerParams.push_registration_url}',`,
            `                deregistration_url: '${workerParams.push_deregistration_url}',`,
            `                public_key: '${workerParams.push_public_key}',`,
            `            }) : null;`,
            `        });`,
            `    });`,
            `}`,
            ``,
        ]);
    }
    
    // >> Write to file...
    waiting = Ui.waiting(`Writing the client entry file: ${clientBundlingConfig.intermediate}`);
    waiting.start();

    // Write
    DotJs.write(clientBuild, clientBundlingConfig.intermediate, 'Client Build File');
        
    waiting.stop();
    Ui.info(Ui.f`Client Build file: ${clientBundlingConfig.intermediate}`);

    // -------------------
    // Run webpack
    // -------------------
    
    if (config.bundling || workerParams.bundling) {
        Ui.log('');
        Ui.title(`BUNDLES`);
    }
    if (workerParams.bundling !== false) {
        await createBundle(Ui, workerBundlingConfig, 'Bundling the Service Worker Build file');
    }
    if (config.bundling !== false) {
        await createBundle(Ui, clientBundlingConfig, 'Bundling the Client Build file');
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
const createBundle = (Ui, config, desc) => {
    const intermediateFile = config.intermediate;
    config = {...config};
    if (!config.entry) {
        config.entry = config.intermediate;
    }
    delete config.intermediate;
    return new Promise(resolve => {
        var waiting = Ui.waiting(`${desc} ...`);
        Ui.log('');
        Ui.info(Ui.f`FROM: ${config.entry}`);
        Ui.info(Ui.f`TO: ${config.output.path + '/' + config.output.filename}`);
        Ui.log('');
        waiting.start();

        // Run
        var compiler = Webpack(config);
        compiler.run((err, stats) => {
            waiting.stop();
            if (err) {
                Ui.title(`Errors!`);
                Ui.error(err);
            }
            Ui.log(stats.toString({
                colors: true,
            }));
            // Remove intermediate build
            Fs.unlinkSync(intermediateFile);
            resolve();
        });
    });
};

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
const buildRoutes = (Ui, entry, build, desc) => {
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

    Ui.log('');
    Ui.title(desc);

    // >> Routes mapping
    build.code.push(`// >> ` + desc);
    build.code.push(`const layout = {};`);

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
                build.code.push(`layout['${routePath || '/'}'] = ${routeName};`);
                // Show
                Ui.log(`> ./ ${relativePath}`);
            }
        });
    }
    if (!indexCount) {
        Ui.log(`> (none)`);
    }
};
