
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import { _beforeLast } from '@webqit/util/str/index.js';
import { _isObject, _isArray } from '@webqit/util/js/index.js';
import * as DotJs from '@webqit/backpack/src/dotfiles/DotJs.js';
import { gzipSync, brotliCompressSync } from 'zlib';
import EsBuild from 'esbuild';

/**
 * @generate
 */
export async function generate() {
    const cx = this || {};
    // -----------
    if (!cx.config.runtime?.Client) {
        throw new Error(`The Client configurator "config.runtime.Client" is required in context.`);
    }
    const clientConfig = await (new cx.config.runtime.Client(cx)).read();
    if (clientConfig.support_service_worker && !cx.config.runtime.client?.Worker) {
        throw new Error(`The Service Worker configurator "config.runtime.client.Worker" is required in context.`);
    }
    const workerConfig = await (new cx.config.runtime.client.Worker(cx)).read();
    // -----------
    if (!cx.config.deployment?.Layout) {
        throw new Error(`The Layout configurator "config.deployment.Layout" is required in context.`);
    }
    const layoutConfig = await (new cx.config.deployment.Layout(cx)).read();
    const dirPublic = Path.resolve(cx.CWD || '', layoutConfig.PUBLIC_DIR);
    const dirSelf = Path.dirname(Url.fileURLToPath(import.meta.url)).replace(/\\/g, '/');
    // -----------
    // Generate client build
    let genClient = getGen.call(cx, dirSelf, layoutConfig.CLIENT_DIR, clientConfig, `The Client Build.`);
    if (clientConfig.support_oohtml) {
        genClient.imports = { [`${dirSelf}/generate.oohtml.js`]: null, ...genClient.imports };
    }
    await bundle.call(cx, genClient, `${dirPublic}/${clientConfig.bundle_filename}`, true/* asModule */);
    cx.logger && cx.logger.log('');
    // -----------
    // Generate worker build
    if (clientConfig.support_service_worker) {
        let genWorker = getGen.call(cx, `${dirSelf}/worker`, layoutConfig.WORKER_DIR, workerConfig, `The Worker Build.`);
        await bundle.call(cx, genWorker, `${dirPublic}/${clientConfig.worker_filename}`);
        cx.logger && cx.logger.log('');
    }
}

/**
 * Compile routes.
 * 
 * @param string modulesDir
 * @param string routesDir
 * @param object paramsObj
 * @param string desc
 * 
 * @return Object
 */
function getGen(modulesDir, routesDir, paramsObj, desc) {
    const cx = this || {};
    if (cx.logger) {
        cx.logger.log(cx.logger.style.comment(`-----------------`));
        cx.logger.log(desc);
        cx.logger.log(cx.logger.style.comment(`-----------------`));
        cx.logger.log('');
    }
    // ------------------
    const gen = { imports: {}, code: [], };
    // ------------------
    // >> Modules import
    gen.imports[`${modulesDir}/index.js`] = `{ start }`;
    gen.code.push(``);
    // ------------------
    // >> Routes mapping
    gen.code.push(`// >> Routes`);
    declareRoutesObj.call(cx, gen, routesDir, 'layout', '');
    gen.code.push(``);
    // ------------------
    // >> Params
    gen.code.push(`// >> Params`);
    declareParamsObj.call(cx, gen, paramsObj, 'params');
    gen.code.push(``);
    // ------------------
    // >> Startup
    gen.code.push(`// >> Startup`);
    gen.code.push(`start.call({ layout, params })`);
    return gen;
}

/**
 * Compile routes.
 * 
 * @param object gen
 * @param string routesDir
 * @param string varName
 * 
 * @return void
 */
function declareRoutesObj(gen, routesDir, varName) {
    const cx = this || {};
    cx.logger && cx.logger.log(`> Declaring routes...`);
    // ----------------
    // Directory walker
    const walk = (dir, callback) => {
        Fs.readdirSync(dir).forEach(f => {
            let resource = Path.join(dir, f);
            if (Fs.statSync(resource).isDirectory()) {
                walk(resource, callback);
            } else {
                let ext = Path.extname(resource) || '';
                callback(resource, ext);
            }
        });
    };
    // ----------------
    // >> Routes mapping
    gen.code.push(`const ${varName} = {};`);
    let indexCount = 0;
    if (routesDir && Fs.existsSync(routesDir)) {
        let clientDirname = routesDir.replace(/\\/g, '/').split('/').pop();
        walk(routesDir, (file, ext) => {
            //relativePath = relativePath.replace(/\\/g, '/');
            if (file.replace(/\\/g, '/').endsWith('/index.js')) {
                let relativePath = Path.relative(routesDir, file).replace(/\\/g, '/');
                // Import code
                let routeName = 'index' + (++ indexCount);
                // IMPORTANT: we;re taking a step back here so that the parent-child relationship for 
                // the directories be involved
                gen.imports[`../${clientDirname}/${relativePath}`] = '* as ' + routeName;
                // Definition code
                let routePath = _beforeLast('/' + relativePath, '/index.js');
                gen.code.push(`${varName}['${routePath || '/'}'] = ${routeName};`);
                // Show
                cx.logger && cx.logger.log(`> ./${relativePath}`);
            }
        });
    }
    if (!indexCount) {
        cx.logger && cx.logger.log(`> (none)`);
    }
    cx.logger && cx.logger.log(``);
}

/**
 * Compile params.
 * 
 * @param object    gen
 * @param object    paramsObj
 * @param string   varName
 * 
 * @return void
 */
function declareParamsObj(gen, paramsObj, varName = null, indentation = 0) {
    const cx = this || {};
    // ----------------
    // Params compilation
    if (varName) gen.code.push(`const ${varName} = {`);
    _isArray(paramsObj)
    Object.keys(paramsObj).forEach(name => {
        let _name = `    ${'    '.repeat(indentation)}${(_isArray(paramsObj) ? '' : (name.includes(' ') ? `'${name}'` : name) + ': ')}`;
        if ([ 'boolean', 'number' ].includes(typeof paramsObj[name])) {
            gen.code.push(`${_name}${paramsObj[name]},`);
        } else if (_isArray(paramsObj[name])) {
            gen.code.push(`${_name}[`);
            declareParamsObj.call(cx, gen, paramsObj[name], null, indentation + 1);
            gen.code.push(`    ${'    '.repeat(indentation)}],`);
        } else if (_isObject(paramsObj[name])) {
            gen.code.push(`${_name}{`);
            declareParamsObj.call(cx, gen, paramsObj[name], null, indentation + 1);
            gen.code.push(`    ${'    '.repeat(indentation)}},`);
        } else {
            gen.code.push(`${_name}'${paramsObj[name]}',`);
        }
    });
    if (varName) gen.code.push(`};`);
}

/**
 * Bundle generated file
 * 
 * @param object    gen
 * @param String    outfile
 * @param boolean   asModule
 * 
 * @return Promise
 */
async function bundle(gen, outfile, asModule = false) {
    const cx = this || {};
    const compression = cx.flags.compress;
    const moduleFile = `${_beforeLast(outfile, '.')}.esm.js`;

    // ------------------
    // >> Show waiting...
    if (cx.logger) {
        let waiting = cx.logger.waiting(cx.logger.f`Writing the ES module file: ${moduleFile}`);
        waiting.start();
        DotJs.write(gen, moduleFile, 'ES Module file');
        waiting.stop();
        cx.logger.info(cx.logger.f`The module file: ${moduleFile}`);
    } else {
        DotJs.write(gen, moduleFile, 'ES Module file');
    }

    // ----------------
    // >> Webpack config
    const bundlingConfig = {
        entryPoints: [ moduleFile ],
        outfile,
        bundle: true,
        minify: true,
        banner: { js: '/** @webqit/webflo */', },
        footer: { js: '', },
        format: 'esm',
    };
    if (!asModule) {
        // Support top-level await
        // See: https://github.com/evanw/esbuild/issues/253#issuecomment-826147115
        bundlingConfig.banner.js += '(async () => {';
        bundlingConfig.footer.js += '})();';
    }

    // ----------------
    // The bundling process
    let waiting;
    if (cx.logger) {
        waiting = cx.logger.waiting(`Bundling...`);
        cx.logger.log('');
        cx.logger.log('> Bundling...');
        cx.logger.info(cx.logger.f`FROM: ${bundlingConfig.entryPoints[0]}`);
        cx.logger.info(cx.logger.f`TO: ${bundlingConfig.outfile}`);
        waiting.start();
    }
    // Run
    await EsBuild.build(bundlingConfig);
    if (waiting) waiting.stop();
    // Remove moduleFile build
    Fs.unlinkSync(bundlingConfig.entryPoints[0]);

    // ----------------
    // Compress...
    if (compression) {
        if (cx.logger) {
            waiting = cx.logger.waiting(`Compressing...`);
            waiting.start();
        }
        const contents = Fs.readFileSync(bundlingConfig.outfile);
        const gzip = gzipSync(contents, {});
        const brotli = brotliCompressSync(contents, {});
        Fs.writeFileSync(`${bundlingConfig.outfile}.gz`, gzip);
        Fs.writeFileSync(`${bundlingConfig.outfile}.br`, brotli);
        if (waiting) {
            waiting.stop();
            cx.logger.log('');
            cx.logger.log('> Compression: .gz, .br');
        }
    }
}