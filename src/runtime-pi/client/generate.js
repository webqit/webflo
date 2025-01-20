
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Jsdom from 'jsdom';
import EsBuild from 'esbuild';
import { _afterLast, _beforeLast } from '@webqit/util/str/index.js';
import { _isObject, _isArray } from '@webqit/util/js/index.js';
import { jsFile } from '@webqit/backpack/src/dotfile/index.js';
import { gzipSync, brotliCompressSync } from 'zlib';
import { pattern } from '../util-url.js';

/**
 * @generate
 */
export async function generate() {
    const cx = this || {};
    // -----------
    if (!cx.config.runtime?.Client) {
        throw new Error(`The Client configurator "config.runtime.Client" is required in context.`);
    }
    if (!cx.config.deployment?.Layout) {
        throw new Error(`The Client configurator "config.deployment.Layout" is required in context.`);
    }
    const clientConfig = await (new cx.config.runtime.Client(cx)).read();
    clientConfig.env = {};
    if (clientConfig.service_worker?.filename && !cx.config.runtime.client?.Worker) {
        throw new Error(`The Service Worker configurator "config.runtime.client.Worker" is required in context.`);
    }
    const workerConfig = await (new cx.config.runtime.client.Worker(cx)).read();
    workerConfig.env = {};
    // -----------
    if (!cx.config.deployment?.Layout) {
        throw new Error(`The Layout configurator "config.deployment.Layout" is required in context.`);
    }
    const layoutConfig = await (new cx.config.deployment.Layout(cx)).read();
    // -----------
    const dirPublic = Path.resolve(cx.CWD || '', layoutConfig.PUBLIC_DIR);
    const dirClient = Path.resolve(cx.CWD || '', layoutConfig.CLIENT_DIR);
    const dirWorker = Path.resolve(cx.CWD || '', layoutConfig.WORKER_DIR);
    const dirSelf = Path.dirname(Url.fileURLToPath(import.meta.url)).replace(/\\/g, '/');
    if (clientConfig.bundle_public_env || workerConfig.bundle_public_env) {
        if (!cx.config.deployment?.Env) {
            throw new Error(`The Layout configurator "config.deployment.Env" is required in context to bundle public env.`);
        }
        const envConfig = await (new cx.config.deployment.Env(cx)).read();
        const env = { ...envConfig.entries, ...process.env };
        for (const key in env) {
            if (!key.includes('PUBLIC_') && !key.includes('_PUBLIC')) continue;
            if (clientConfig.bundle_public_env) {
                clientConfig.env[key] = env[key];
            }
            if (workerConfig.bundle_public_env) {
                workerConfig.env[key] = env[key];
            }
        }
    }
    // -----------
    // Scan Subdocuments
    const scanSubroots = (sparoot, rootFileName) => {
        let dir = Path.join(dirPublic, sparoot), passes = 0;
        return [ Fs.readdirSync(dir).reduce((sparoots, f) => {
            let resource = Path.join(dir, f);
            if (Fs.statSync(resource).isDirectory()) {
                let subsparoot = Path.join(sparoot, f);
                if (Fs.existsSync(Path.join(resource, rootFileName))) {
                    return sparoots.concat(subsparoot);
                }
                passes ++;
                return sparoots.concat(scanSubroots(subsparoot, rootFileName)[ 0 ]);
            }
            return sparoots;
        }, []), passes ];
    };
    // -----------
    // Generate client build
    const generateClient = async function(sparoot, spaGraphCallback = null) {
        let [ subsparoots, targets ] = (sparoot && scanSubroots(sparoot, 'index.html')) || [ [], false ];
        if (!sparoot) sparoot = '/';
        let spaRouting = { root: sparoot, subroots: subsparoots, targets };
        let codeSplitting = !!(sparoot !== '/' || subsparoots.length);
        let outfileMain = Path.join(sparoot, clientConfig.bundle_filename),
            outfileWebflo = _beforeLast(clientConfig.bundle_filename, '.js') + '.webflo.js';
        let gen = { imports: {}, code: [], };
        // ------------------
        const initWebflo = gen => {
            gen.imports[`${dirSelf}/index.js`] = `* as Webflo`;
            gen.code.push(``);
            gen.code.push(`if (!self.webqit) {self.webqit = {};}`);
            gen.code.push(`webqit.Webflo = Webflo`);
            return gen;
        };
        // ------------------
        if (!codeSplitting) {
            initWebflo(gen);
        } else if (sparoot === '/') {
            if (cx.logger) {
                cx.logger.log(cx.logger.style.keyword(`-----------------`));
                cx.logger.log(`Base Build`);
                cx.logger.log(cx.logger.style.keyword(`-----------------`));
            }
            let gen1 = initWebflo({ imports: {}, code: [], });
            await bundle.call(cx, gen1, Path.join(dirPublic, outfileWebflo), true/* asModule */);
        }
        // ------------------
        if (cx.logger) {
            cx.logger.log(cx.logger.style.keyword(`-----------------`));
            cx.logger.log(`Client Build ` + cx.logger.style.comment(`(sparoot:${sparoot}; is-split:${codeSplitting})`));
            cx.logger.log(cx.logger.style.keyword(`-----------------`));
        }
        gen.code.push(`const { start } = webqit.Webflo`);
        // ------------------
        // Bundle
        declareStart.call(cx, gen, dirClient, dirPublic, clientConfig, spaRouting);
        await bundle.call(cx, gen, Path.join(dirPublic, outfileMain), true/* asModule */);
        // ------------------
        // Embed/unembed
        let targetDocumentFile = Path.join(dirPublic, sparoot, 'index.html'),
            outfileWebfloPublic = Path.join(clientConfig.public_base_url, outfileWebflo),
            outfileMainPublic = Path.join(clientConfig.public_base_url, outfileMain),
            embedList = [],
            unembedList = [];
        if (cx.flags['auto-embed']) {
            if (codeSplitting) {
                embedList.push(outfileWebfloPublic);
            } else {
                unembedList.push(outfileWebfloPublic);
            }
            embedList.push(outfileMainPublic);
        } else {
            unembedList.push(outfileWebfloPublic, outfileMainPublic);
        }
        handleEmbeds(targetDocumentFile, embedList, unembedList);
        // ------------------
        // Recurse
        spaGraphCallback && spaGraphCallback(sparoot, subsparoots);
        if (cx.flags.recursive) {
            while (subsparoots.length) {
                await generateClient(subsparoots.shift(), spaGraphCallback);
            }
        }
    };
    // -----------
    // Generate worker build
    const generateWorker = async function(workerroot, workerGraphCallback = null) {
        let [ subworkerroots, targets ] = workerroot && scanSubroots(workerroot, 'workerroot') || [ [], false ];
        if (!workerroot) workerroot = '/';
        let workerRouting = { root: workerroot, subroots: subworkerroots, targets };
        let gen = { imports: {}, code: [], };
        if (cx.logger) {
            cx.logger.log(cx.logger.style.comment(`-----------------`));
            cx.logger.log(`Worker Build - workerroot:${workerroot}`);
            cx.logger.log(cx.logger.style.comment(`-----------------`));
        }
        // ------------------
        // >> Modules import
        gen.imports[`${dirSelf}/worker/index.js`] = `{ start }`;
        gen.code.push(``);
        gen.code.push(`self.webqit = {}`);
        gen.code.push(``);
        // ------------------
        // Bundle
        for (const strategy of [ 'cache_first_urls', 'cache_only_urls' ]) {
            if (workerConfig[strategy].length) {
                // Separate URLs from patterns
                let [ urls, patterns ] = workerConfig[strategy].reduce(([ urls, patterns ], url) => {
                    let patternInstance = pattern(url, 'http://localhost'),
                        isPattern = patternInstance.isPattern();
                    if (isPattern && (patternInstance.pattern.pattern.hostname !== 'localhost' || patternInstance.pattern.pattern.port)) {
                        throw new Error(`Pattern URLs must have no origin part. Recieved "${url}".`);
                    }
                    return isPattern ? [ urls, patterns.concat(patternInstance) ] : [ urls.concat(url), patterns ];
                }, [ [], [] ]);
                // Resolve patterns
                if (patterns.length) {
                    // List all files
                    let scan = dir => Fs.readdirSync(dir).reduce((result, f) => {
                        let resource = Path.join(dir, f);
                        if (f.startsWith('.')) return result;
                        return result.concat(Fs.statSync(resource).isDirectory() ? scan(resource) : '/' + Path.relative(dirPublic, resource));
                    }, []);
                    let files = scan(dirPublic);
                    // Resolve patterns from files
                    workerConfig[strategy] = patterns.reduce((all, pattern) => {
                        let matchedFiles = files.filter(file => pattern.test(file, 'http://localhost'));
                        if (matchedFiles.length) return all.concat(matchedFiles);
                        throw new Error(`The pattern "${pattern.pattern.pattern.pathname}" didn't match any files.`);
                    }, urls);
                }
            }
        }
        declareStart.call(cx, gen, dirWorker, dirPublic, workerConfig, workerRouting);
        await bundle.call(cx, gen, Path.join(dirPublic, workerroot, clientConfig.service_worker.filename));
        // ------------------
        // Recurse
        workerGraphCallback && workerGraphCallback(workerroot, subworkerroots);
        if (cx.flags.recursive) {
            while (subworkerroots.length) {
                await generateWorker(subworkerroots.shift());
            }
        }
    };
    // -----------
    // Generate now...
    let sparootsFile = Path.join(dirPublic, 'sparoots.json');
    if (clientConfig.spa_routing !== false) {
        const sparoots = [];
        await generateClient('/', root => sparoots.push(root));
        Fs.writeFileSync(sparootsFile, JSON.stringify(sparoots, null, 4));
    } else {
        await generateClient();
        Fs.existsSync(sparootsFile) && Fs.unlinkSync(sparootsFile);
    }
    if (clientConfig.service_worker.filename) {
        await generateWorker('/');
    }
}

/**
 * Compile routes.
 * 
 * @param object    gen
 * @param string    routesDir
 * @param string    targetPublic
 * @param object    paramsObj
 * @param object    routing
 * 
 * @return Object
 */
function declareStart(gen, routesDir, targetDir, paramsObj, routing) {
    const cx = this || {};
    // ------------------
    // >> Routes mapping
    gen.code.push(`// >> Routes`);
    declareRoutesObj.call(cx, gen, routesDir, targetDir, 'layout', routing);
    gen.code.push(``);
    // ------------------
    // >> Params
    gen.code.push(`// >> Params`);
    declareParamsObj.call(cx, gen, { ...paramsObj, routing }, 'params');
    gen.code.push(``);
    // ------------------
    // >> Startup
    gen.code.push(`// >> Startup`);
    gen.code.push(`webqit.app = await start.call({ layout, params })`);
}

/**
 * Compile routes.
 * 
 * @param object    gen
 * @param string    routesDir
 * @param string    targetDir
 * @param string    varName
 * @param object    routing
 * 
 * @return void
 */
function declareRoutesObj(gen, routesDir, targetDir, varName, routing) {
    const cx = this || {};
    let _routesDir = Path.join(routesDir, routing.root),
        _targetDir = Path.join(targetDir, routing.root);
    cx.logger && cx.logger.log(cx.logger.style.keyword(`> `) + `Declaring routes...`);
    // ----------------
    // Directory walker
    const walk = (dir, callback) => {
        Fs.readdirSync(dir).forEach(f => {
            let resource = Path.join(dir, f);
            let _namespace = '/' + Path.relative(routesDir, resource).replace(/\\/g, '/');
            let namespace = _beforeLast(_namespace, '/index.js') || '/';
            if (Fs.statSync(resource).isDirectory()) {
                if (routing.subroots.includes(namespace)) return;
                walk(resource, callback);
            } else {
                let relativePath = Path.relative(_targetDir, resource).replace(/\\/g, '/');
                callback(resource, namespace, relativePath);
            }
        });
    };
    // ----------------
    // >> Routes mapping
    gen.code.push(`const ${varName} = {};`);
    let indexCount = 0;
    if (Fs.existsSync(_routesDir)) {
        walk(_routesDir, (file, namespace, relativePath) => {
            if (relativePath.endsWith('/index.js')) {
                // Import code
                let routeName = 'index' + (++ indexCount);
                // IMPORTANT: we;re taking a step back here so that the parent-child relationship for 
                // the directories be involved
                gen.imports[relativePath] = '* as ' + routeName;
                // Definition code
                gen.code.push(`${varName}['${namespace}'] = ${routeName};`);
                // Show
                cx.logger && cx.logger.log(cx.logger.style.comment(`  [${namespace}]:   `) + cx.logger.style.url(relativePath) + cx.logger.style.comment(` (${Fs.statSync(file).size / 1024} KB)`));
            }
        });
    }
    if (!indexCount) {
        cx.logger && cx.logger.log(cx.logger.style.comment(`  (none)`));
    }
}

/**
 * Compile params.
 * 
 * @param object    gen
 * @param object    paramsObj
 * @param string    varName
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
    const compression = !cx.flags.compression ? false : (
        cx.flags.compression === true ? ['gz'] : cx.flags.compression.split(',').map(s => s.trim())
    );
    const moduleFile = `${_beforeLast(outfile, '.')}.esm.js`;

    // ------------------
    // >> Show waiting...
    if (cx.logger) {
        let waiting = cx.logger.waiting(cx.logger.f`Writing the ES module file: ${moduleFile}`);
        waiting.start();
        jsFile.write(gen, moduleFile, 'ES Module file');
        waiting.stop();
    } else {
        jsFile.write(gen, moduleFile, 'ES Module file');
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
        cx.logger.log(cx.logger.style.keyword(`> `) + 'Bundling...');
        waiting.start();
    }
    // Main
    await EsBuild.build(bundlingConfig);
    // Compress...
    let compressedFiles = [], removals = [];
    if (compression) {
        const contents = Fs.readFileSync(bundlingConfig.outfile);
        if (compression.includes('gz')) {
            const gzip = gzipSync(contents, {});
            Fs.writeFileSync(bundlingConfig.outfile + '.gz', gzip);
            compressedFiles.push(bundlingConfig.outfile + '.gz');
        } else {
            removals.push(bundlingConfig.outfile + '.gz');
        }
        if (compression.includes('br')) {
            const brotli = brotliCompressSync(contents, {});
            Fs.writeFileSync(bundlingConfig.outfile + '.br', brotli);
            compressedFiles.push(bundlingConfig.outfile + '.br');
        } else {
            removals.push(bundlingConfig.outfile + '.br');
        }
    }
    // Remove moduleFile build
    Fs.unlinkSync(bundlingConfig.entryPoints[0]);
    removals.forEach(file => Fs.existsSync(file) && Fs.unlinkSync(file));
    if (waiting) waiting.stop();
    // ----------------
    // Stats
    if (cx.logger) {
        [bundlingConfig.outfile].concat(compressedFiles).forEach(file => {
            let ext = '.' + _afterLast(file, '.');
            cx.logger.info(cx.logger.style.comment(`  [${ext}]: `) + cx.logger.style.url(file) + cx.logger.style.comment(` (${Fs.statSync(file).size / 1024} KB)`));
        });
        cx.logger.log('');
    }
}

/**
 * Handles auto-embeds
 * 
 * @param String    targetDocumentFile
 * @param Array     embedList
 * @param Array     unembedList
 * 
 * @return Void
 */
function handleEmbeds(targetDocumentFile, embedList, unembedList) {
    let targetDocument, successLevel = 0;
    if (Fs.existsSync(targetDocumentFile) && (targetDocument = Fs.readFileSync(targetDocumentFile).toString()) && targetDocument.trim().startsWith('<!DOCTYPE html')) {
        successLevel = 1;
        let dom = new Jsdom.JSDOM(targetDocument), by = 'webflo', touched;
        let embed = (src, after) => {
            src = src.replace(/\\/g, '/');
            let embedded = dom.window.document.querySelector(`script[src="${src}"]`);
            if (!embedded) {
                embedded = dom.window.document.createElement('script');
                embedded.setAttribute('type', 'module');
                embedded.setAttribute('src', src);
                embedded.setAttribute('by', by);
                if (after) {
                    after.after(embedded, `\n\t\t`);
                } else {
                    dom.window.document.head.appendChild(embedded);
                }
                touched = true;
            }
            return embedded;
        };
        let unembed = src => {
            src = Path.join('/', src);
            src = src.replace(/\\/g, '/');
            let embedded = dom.window.document.querySelector(`script[src="${src}"][by="${by}"]`);
            if (embedded) {
                embedded.remove();
                touched = true;
            }
        };
        embedList.reduce((prev, src) => {
            return embed(src, prev);
        }, [ ...dom.window.document.head.querySelectorAll(`script[src]`) ].pop() || dom.window.document.querySelector(`script`));
        unembedList.forEach(src => {
            unembed(src);
        });
        if (touched) {
            Fs.writeFileSync(targetDocumentFile, dom.serialize());
            successLevel = 2;
        }
    }
    return successLevel;
}