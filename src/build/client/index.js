
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Webpack from 'webpack';
import { _beforeLast } from '@webqit/util/str/index.js';
import { _isObject, _isArray, _isEmpty } from '@webqit/util/js/index.js';
import * as DotJs from '@webqit/backpack/src/dotfiles/DotJs.js';
import * as client from '../../config/client.js'


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
    var modulesDir = forwardSlash(Url.fileURLToPath(Path.join(import.meta.url, '../../../runtime/client')));
    
    var workerDirSplit = Path.resolve(layout.WORKER_DIR).replace(/\\/g, '/').split('/');
    var workerParams = config.worker || {};
    const workerBundlingConfig = workerParams.bundling || {};

    var clientDirSplit = Path.resolve(layout.CLIENT_DIR).replace(/\\/g, '/').split('/');
    var clientParams = config; // Yes root config object
    const clientBundlingConfig = clientParams.bundling || {};

    var waiting;

    // -------------------
    // Create the Service Worker file
    // -------------------

    if (!_isEmpty(workerParams)) {

        Ui.log('');
        Ui.title(`SERVICE WORKER BUILD`);

        const workerBuild = { imports: {}, code: [], };
        workerBuild.imports[modulesDir + '/Worker.js'] = 'Worker';
       
        // ------------------
        // >> Routes mapping
        buildRoutes(workerBuild, Ui, Path.resolve(layout.WORKER_DIR), 'Worker-Side Routing:');
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Params`);
        buildParams(workerBuild, workerParams, 'params');
        workerBuild.code.push(``);
        workerBuild.code.push(`// >> Worker Instantiation`);
        workerBuild.code.push(`Worker.call(null, layout, params);`);
        // ------------------
        
        // ------------------
        // >> Write to file...
        workerBundlingConfig.intermediate = workerBundlingConfig.intermediate || `${clientDirSplit.join('/')}/worker.js`;
        workerBundlingConfig.output = workerBundlingConfig.output || {
            filename: 'worker.js',
            path: Path.resolve(layout.PUBLIC_DIR),
        };
        waiting = Ui.waiting(Ui.f`Writing the Service Worker file: ${workerBundlingConfig.intermediate}`);
        waiting.start();
        DotJs.write(workerBuild, workerBundlingConfig.intermediate, 'Service Worker File');
        waiting.stop();
        Ui.info(Ui.f`Service Worker file: ${workerBundlingConfig.intermediate}`);
        // ------------------
    }

    // -------------------
    // Create the Client file
    // -------------------

    Ui.log('');
    Ui.title(`CLIENT BUILD`);

    const clientBuild = { imports: {}, code: [], };
    clientBuild.imports[modulesDir + '/Runtime.js'] = 'Runtime';

    // ------------------
    // >> Routes mapping
    buildRoutes(clientBuild, Ui, Path.resolve(layout.CLIENT_DIR), 'Client-Side Routing:');
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Runtime Params`);
    buildParams(clientBuild, clientParams, 'params');
    clientBuild.code.push(``);
    clientBuild.code.push(`// >> Runtime Instantiation`);
    clientBuild.code.push(`Runtime.call(null, layout, params);`);
    // ------------------
    
    // ------------------
    // >> Write to file...
    clientBundlingConfig.intermediate = clientBundlingConfig.intermediate || clientDirSplit.join('/') + '/bundle.js';
    clientBundlingConfig.output = clientBundlingConfig.output || {
        filename: 'bundle.js',
        path: Path.resolve(layout.PUBLIC_DIR),
    };
    waiting = Ui.waiting(`Writing the client entry file: ${clientBundlingConfig.intermediate}`);
    waiting.start();
    DotJs.write(clientBuild, clientBundlingConfig.intermediate, 'Runtime Build File');
    waiting.stop();
    Ui.info(Ui.f`Runtime Build file: ${clientBundlingConfig.intermediate}`);
    // ------------------

    // -------------------
    // Run webpack
    // -------------------
    
    if (clientParams.bundling || workerParams.bundling) {
        Ui.log('');
        Ui.title(`BUNDLES`);
    }
    if (workerParams.bundling !== false) {
        await createBundle(Ui, workerBundlingConfig, 'Bundling the Service Worker Build file');
    }
    if (clientParams.bundling !== false) {
        clientBundlingConfig.experiments = clientBundlingConfig.experiments || {};
        if (!('outputModule' in clientBundlingConfig.experiments)) {
            clientBundlingConfig.experiments.outputModule = true;
            clientBundlingConfig.externalsType = 'module';
        }
        if (clientBundlingConfig.experiments.outputModule !== false) {
            clientBundlingConfig.output = clientBundlingConfig.output || {};
            clientBundlingConfig.output.environment = clientBundlingConfig.output.environment || {};
            if (!('module' in clientBundlingConfig.output)) {
                clientBundlingConfig.output.module = true;
                clientBundlingConfig.output.environment.module = true;
            }
        }
        await createBundle(Ui, clientBundlingConfig, 'Bundling the Runtime Build file');
    }
    
}

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
    config = { ...config };
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
const buildRoutes = (build, Ui, entry, desc) => {
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
        var clientDirname = entry.replace(/\\/g, '/').split('/').pop();
        walk(entry, (file, ext) => {
            //relativePath = relativePath.replace(/\\/g, '/');
            if (file.replace(/\\/g, '/').endsWith('/index.js')) {
                var relativePath = Path.relative(entry, file).replace(/\\/g, '/');
                // Import code
                var routeName = 'index' + (++ indexCount);
                // IMPORTANT: we;re taking a step back here so that the parent-child relationship for 
                // the directories be involved
                build.imports[`../${clientDirname}/${relativePath}`] = '* as ' + routeName;
                // Definition code
                var routePath = _beforeLast('/' + relativePath, '/index.js');
                build.code.push(`layout['${routePath || '/'}'] = ${routeName};`);
                // Show
                Ui.log(`> ./${relativePath}`);
            }
        });
    }
    if (!indexCount) {
        Ui.log(`> (none)`);
    }
};

const buildParams = (build, params, varName = null, indentation = 0) => {
    if (varName) build.code.push(`const ${varName} = {`);
    Object.keys(params).forEach(name => {
        var _name = `    ${'    '.repeat(indentation)}${(_isArray(params) ? '' : (name.includes(' ') ? `'${name}'` : name) + ': ')}`;
        if ([ 'boolean', 'number' ].includes(typeof params[name])) {
            build.code.push(`${_name}${params[name]},`);
        } else if (_isArray(params[name])) {
            build.code.push(`${_name}[`);
            buildParams(build, params[name], null, indentation + 1);
            build.code.push(`    ${'    '.repeat(indentation)}],`);
        } else if (_isObject(params[name])) {
            build.code.push(`${_name}{`);
            buildParams(build, params[name], null, indentation + 1);
            build.code.push(`    ${'    '.repeat(indentation)}},`);
        } else {
            build.code.push(`${_name}'${params[name]}',`);
        }
    });
    if (varName) build.code.push(`};`);
};
