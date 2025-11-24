import Fs from 'fs';
import Path from 'path';
import Url from 'url';
import Jsdom from 'jsdom';
import EsBuild from 'esbuild';
import { gzipSync, brotliCompressSync } from 'zlib';
import { _afterLast, _beforeLast } from '@webqit/util/str/index.js';
import { _isObject, _isArray } from '@webqit/util/js/index.js';
import { jsFile } from '@webqit/backpack/src/dotfile/index.js';
import { bootstrap as serverBootstrap } from '../runtime-pi/webflo-server/bootstrap.js';
import { bootstrap as clientBootstrap } from '../runtime-pi/webflo-client/bootstrap.js';
import { bootstrap as workerBootstrap } from '../runtime-pi/webflo-worker/bootstrap.js';
import { UseLiveTransform } from './esbuild-plugin-uselive-transform.js';
import { CLIContext } from '../CLIContext.js';
import '../runtime-pi/webflo-url/urlpattern.js';

function declareConfig({ $source, configExport, indentation = 0 }) {
    const varName = 'config';
    if (!indentation) {
        $source.code.push(`const ${varName} = {`);
    }
    Object.keys(configExport).forEach((name) => {
        const $name = `    ${'    '.repeat(indentation)}${(_isArray(configExport) ? '' : (name.includes(' ') ? `'${name}'` : name) + ': ')}`;
        if (['boolean', 'number'].includes(typeof configExport[name])) {
            $source.code.push(`${$name}${configExport[name]},`);
        } else if (_isArray(configExport[name])) {
            $source.code.push(`${$name}[`);
            declareConfig({
                $source,
                configExport: configExport[name],
                indentation: indentation + 1
            });
            $source.code.push(`    ${'    '.repeat(indentation)}],`);
        } else if (_isObject(configExport[name])) {
            $source.code.push(`${$name}{`);
            declareConfig({
                $source,
                configExport: configExport[name],
                indentation: indentation + 1
            });
            $source.code.push(`    ${'    '.repeat(indentation)}},`);
        } else {
            $source.code.push(`${$name}'${configExport[name]}',`);
        }
    });
    if (!indentation) {
        $source.code.push(`};`);
    }
}

function declareRoutes({ $context, $source, bootstrap }) {
    const { flags: FLAGS, logger: LOGGER } = $context;
    LOGGER?.log(LOGGER.style.keyword(`> `) + `Declaring routes...`);

    // Define vars
    const varName = 'routes';
    const targetDir = FLAGS.outdir || bootstrap.outdir;

    // >> Routes mapping
    $source.code.push(`const ${varName} = {};`);

    // Route entries
    let routeCount = 0;
    for (const route of Object.keys(bootstrap.routes)) {
        const file = bootstrap.routes[route];
        const fstat = Fs.statSync(file);
        // The "import" code
        const routeId = 'route' + (++routeCount);
        const importPath = file;
        $source.imports[importPath] = '* as ' + routeId;
        // The route def
        $source.code.push(`${varName}['${route}'] = ${routeId};`);
        // Show
        LOGGER?.log(
            LOGGER.style.comment(`  [${route}]:   `) + LOGGER.style.url(importPath) + LOGGER.style.comment(` (${fstat.size / 1024} KB)`)
        );
    }

    if (!routeCount) {
        LOGGER?.log(LOGGER.style.comment(`  (none)`));
    }
}

function writeImportWebflo($source, which) {
    const importUrl = Url.fileURLToPath(import.meta.url);
    const importPath = Path.join(Path.dirname(importUrl), `../runtime-pi/webflo-${which}/index.js`);
    $source.imports[importPath] = `{ start }`;
}

function writeScriptBody({ $context, $source, bootstrap, configExport, which }) {
    // >> Init
    if (bootstrap.$init) {
        const importPath = bootstrap.$init;
        $source.imports[importPath] = `* as init`;
    } else {
        $source.code.push(`const init = null;`);
    }

    // >> Config
    $source.code.push(`// >> Config export`);
    declareConfig({ $source, configExport });
    $source.code.push(``);

    // >> Routes mapping
    $source.code.push(`// >> Routes`);
    declareRoutes({ $context, $source, bootstrap, which });
    $source.code.push(``);

    // >> Specials
    $source.code.push(`// >> Routes`);
    $source.code.push(`const $root = '${bootstrap.offset || null}';`);
    $source.code.push(`const $roots = ${bootstrap.$roots?.length ? JSON.stringify(bootstrap.$roots) : '[]'};`);
    $source.code.push(`const $sparoots = ${bootstrap.$sparoots?.length ? JSON.stringify(bootstrap.$sparoots) : '[]'};`);
    $source.code.push(``);

    // >> Startup
    $source.code.push(`// >> Startup`);
    $source.code.push(`globalThis.webqit = globalThis.webqit || {};`);
    $source.code.push(`globalThis.webqit.app = await start({ init, config, routes, $root, $roots, $sparoots });`);
}

async function bundleScript({ $context, $source, which, outfile, asModule = true, ...restParams }) {
    const { flags: FLAGS, logger: LOGGER } = $context;
    // >> Show banner...
    LOGGER?.log(LOGGER.style.keyword(`---`));
    LOGGER?.log(`Bundling ${which} build`);
    LOGGER?.log(LOGGER.style.keyword(`---`));
    // Apply compression?
    const compression = !FLAGS.compression ? false : (
        FLAGS.compression === true ? ['gz'] : FLAGS.compression.split(',').map(s => s.trim())
    );
    const moduleFile = `${_beforeLast(outfile, '.')}.esm.js`;
    // >> Show waiting...
    if (LOGGER) {
        const waiting = LOGGER.waiting(
            LOGGER.f`Writing the ES module file: ${moduleFile}`
        );
        waiting.start();
        jsFile.write($source, moduleFile, 'ES Module file');
        waiting.stop();
    } else {
        jsFile.write($source, moduleFile, 'ES Module file');
    }
    // >> esbuild config
    const bundlingConfig = {
        entryPoints: [moduleFile],
        outfile,
        format: asModule ? 'esm' : 'iife',
        platform: which === 'server' ? 'node' : 'browser', // optional but good for clarity
        bundle: which === 'server' ? false : true,
        minify: which === 'server' ? false : true,
        treeShaking: true,   // Important optimization
        banner: { js: '/** @webqit/webflo */', },
        footer: { js: '', },
        plugins: [UseLiveTransform()],
        ...(restParams.buildParams || {})
    };
    if (!asModule) {
        // Support top-level await
        // See: https://github.com/evanw/esbuild/issues/253#issuecomment-826147115
        bundlingConfig.banner.js += '(async () => {';
        bundlingConfig.footer.js += '})();';
    }
    // The bundling process
    let waiting;
    if (LOGGER) {
        waiting = LOGGER.waiting(`Bundling...`);
        LOGGER.log(
            LOGGER.style.keyword(`> `) + 'Bundling...'
        );
        waiting.start();
    }
    // Main
    await EsBuild.build(bundlingConfig);
    // Compress...
    const compressedFiles = [];
    const removals = [];
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
    } else {
        removals.push(bundlingConfig.outfile + '.gz');
        removals.push(bundlingConfig.outfile + '.br');
    }
    // Remove moduleFile build
    Fs.unlinkSync(bundlingConfig.entryPoints[0]);
    removals.forEach((file) => Fs.existsSync(file) && Fs.unlinkSync(file));
    if (waiting) waiting.stop();
    // ----------------
    // Stats
    if (LOGGER) {
        [bundlingConfig.outfile].concat(compressedFiles).forEach((file) => {
            let ext = '.' + _afterLast(file, '.');
            LOGGER.info(LOGGER.style.comment(`  [${ext}]: `) + LOGGER.style.url(file) + LOGGER.style.comment(` (${Fs.statSync(file).size / 1024} KB)`));
        });
        LOGGER.log('');
    }
    return [bundlingConfig.outfile].concat(compressedFiles);
}

function handleEmbeds($context, embeds, targetDocumentFile) {
    if (!Fs.existsSync(targetDocumentFile)) {
        return 0;
    }
    const targetDocument = Fs.readFileSync(targetDocumentFile).toString();
    if (!/\<\!DOCTYPE html/i.test(targetDocument.trim())) {
        return 0;
    }
    const { logger: LOGGER } = $context;
    let successLevel = 1, touched;
    // >> Show banner...
    LOGGER?.log(LOGGER.style.keyword(`---`));
    LOGGER?.log(`Embedding client build`);
    LOGGER?.log(LOGGER.style.keyword(`---`));
    // Embed...
    const dom = new Jsdom.JSDOM(targetDocument);
    const by = 'webflo';
    function embed(src, after) {
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
    function unembed(src) {
        src = Path.join('/', src);
        src = src.replace(/\\/g, '/');
        let embedded = dom.window.document.querySelector(`script[src="${src}"][by="${by}"]`);
        if (embedded) {
            embedded.remove();
            touched = true;
        }
    };
    embeds.all.forEach((src) => {
        if (embeds.current.includes(src)) return;
        unembed(src);
    });
    embeds.current.reduce((prev, src) => {
        return embed(src, prev);
    }, [...dom.window.document.head.querySelectorAll(`script[src]`)].pop() || dom.window.document.querySelector(`script`));
    if (touched) {
        Fs.writeFileSync(targetDocumentFile, dom.serialize());
        successLevel = 2;
    }
    return successLevel;
}

// -------------

async function generateClientScript({ $context, bootstrap, ...restParams }) {
    const { flags: FLAGS, logger: LOGGER } = $context;

    const inSplitMode = !!bootstrap.$roots.length || !!bootstrap.offset;

    const targetDocumentFile = Path.join(FLAGS.outdir || bootstrap.outdir, 'index.html');
    const publicBaseUrl = bootstrap.config.CLIENT.public_base_url;

    const sharedBuild_filename = bootstrap.config.CLIENT.filename.replace(/\.js$/, '.webflo.js');
    const outfile_sharedBuild = Path.join(bootstrap.config.LAYOUT.PUBLIC_DIR, sharedBuild_filename);
    const outfile_sharedBuildPublic = Path.join(publicBaseUrl, sharedBuild_filename);

    const outfile_clientBuild = Path.join(FLAGS.outdir || bootstrap.outdir, bootstrap.config.CLIENT.filename);
    const outfile_clientBuildPublic = Path.join(publicBaseUrl, Path.relative(bootstrap.config.LAYOUT.PUBLIC_DIR, outfile_clientBuild));

    const $source = { imports: {}, code: [] };
    const embeds = { all: [], current: [] };

    const configExport = structuredClone({ ENV: bootstrap.config.ENV, CLIENT: bootstrap.config.CLIENT, WORKER: {} });
    if (bootstrap.config.CLIENT.capabilities?.service_worker === true) {
        const outfile_workerBuild = Path.join(FLAGS.outdir || bootstrap.outdir, bootstrap.config.WORKER.filename);
        const outfile_workerBuildPublic = Path.join(publicBaseUrl, Path.relative(bootstrap.config.LAYOUT.PUBLIC_DIR, outfile_workerBuild));
        configExport.WORKER = {
            filename: outfile_workerBuildPublic,
            scope: bootstrap.config.WORKER.scope
        };
    }

    const outfiles = [];
    if (inSplitMode) {
        if (!bootstrap.offset) {
            LOGGER?.log(LOGGER.style.keyword(`---`));
            LOGGER?.log(`[SPLIT_MODE] Base Build`);
            LOGGER?.log(LOGGER.style.keyword(`---`));
            // Write the import code and bundle
            const $$source = { imports: {}, code: [], };
            writeImportWebflo($$source, 'client');
            const _outfiles = await bundleScript({
                $context,
                $source: $$source,
                which: 'client',
                outfile: outfile_sharedBuild,
                asModule: true
            });
            outfiles.push(..._outfiles);
        }
        if (FLAGS['auto-embed']) {
            embeds.current.push(outfile_sharedBuildPublic);
            embeds.current.push(outfile_clientBuildPublic);
        }
    } else {
        writeImportWebflo($source, 'client');
        if (FLAGS['auto-embed']) {
            embeds.current.push(outfile_clientBuildPublic);
        }
    }

    writeScriptBody({
        $context,
        $source,
        bootstrap,
        configExport,
        which: 'client',
        ...restParams
    });

    const _outfiles = await bundleScript({
        $context,
        $source,
        which: 'client',
        outfile: outfile_clientBuild,
        asModule: true,
        ...restParams
    });
    outfiles.push(..._outfiles);

    embeds.all.push(outfile_sharedBuildPublic);
    embeds.all.push(outfile_clientBuildPublic);
    handleEmbeds($context, embeds, targetDocumentFile);

    return outfiles;
}

async function generateWorkerScript({ $context, bootstrap, ...restParams }) {
    const { flags: FLAGS } = $context;

    const $source = { imports: {}, code: [] };

    const outfile_workerBuild = Path.join(FLAGS.outdir || bootstrap.outdir, bootstrap.config.WORKER.filename);

    const configExport = structuredClone({ ENV: bootstrap.config.ENV, CLIENT: { capabilities: {} }, WORKER: bootstrap.config.WORKER });
    if (bootstrap.config.CLIENT.capabilities?.webpush === true) {
        configExport.CLIENT.capabilities = {
            webpush: true
        };
    }

    for (const strategy of ['cache_first_urls', 'cache_only_urls']) {
        if (configExport.WORKER[strategy].length) {
            const [urls, patterns] = configExport.WORKER[strategy].reduce(([urls, patterns], url) => {
                const patternInstance = new URLPattern(url, 'http://localhost');
                const isPattern = patternInstance.isPattern();
                if (isPattern && (patternInstance.pattern.hostname !== 'localhost' || patternInstance.pattern.port)) {
                    throw new Error(`Pattern URLs must have no origin part. Recieved "${url}".`);
                }
                return isPattern ? [urls, patterns.concat(patternInstance)] : [urls.concat(url), patterns];
            }, [[], []]);
            if (patterns.length) {
                function scanDir(dir) {
                    Fs.readdirSync(dir).reduce((result, f) => {
                        const resource = Path.join(dir, f);
                        if (f.startsWith('.')) return result;
                        return result.concat(
                            Fs.statSync(resource).isDirectory() ? scanDir(resource) : '/' + Path.relative(bootstrap.config.LAYOUT.PUBLIC_DIR, resource)
                        );
                    }, []);
                }
                const files = scanDir(bootstrap.config.LAYOUT.PUBLIC_DIR);
                configExport.WORKER[strategy] = patterns.reduce((all, pattern) => {
                    const matchedFiles = files.filter((file) => pattern.test(file, 'http://localhost'));
                    if (matchedFiles.length) return all.concat(matchedFiles);
                    throw new Error(`The pattern "${pattern.pattern.pathname}" didn't match any files.`);
                }, urls);
            }
        }
    }

    writeImportWebflo($source, 'worker');
    writeScriptBody({
        $context,
        $source,
        bootstrap,
        configExport,
        which: 'worker',
        ...restParams
    });

    return await bundleScript({
        $context,
        $source,
        which: 'worker',
        outfile: outfile_workerBuild,
        asModule: true,
        ...restParams
    });
}

async function generateServerScript({ $context, bootstrap, ...restParams }) {
    const $source = { imports: {}, code: [] };
    const outfile_serverBuild = Path.join(bootstrap.outdir, 'app.js'); // Must not consult FLAGS.outdir

    writeImportWebflo($source, 'server');
    writeScriptBody({
        $context,
        $source,
        bootstrap,
        configExport: bootstrap.config,
        which: 'server',
        ...restParams
    });

    return await bundleScript({
        $context,
        $source,
        which: 'server',
        outfile: outfile_serverBuild,
        asModule: true,
        ...restParams
    });
}

export async function build() {
    const $context = this;
    if (!($context instanceof CLIContext)) {
        throw new Error(`The "this" context must be a Webflo CLIContext object.`);
    }

    const buildParams = {};
    const outfiles = [];
    if ($context.flags.client) {
        const bootstrap = await clientBootstrap($context);
        const _outfiles = await generateClientScript({ $context, bootstrap, buildParams });
        outfiles.push(..._outfiles);
    }

    if ($context.flags.worker) {
        const bootstrap = await workerBootstrap($context);
        const _outfiles = await generateWorkerScript({ $context, bootstrap, buildParams });
        outfiles.push(..._outfiles);
    }

    if (false) { // TODO: WebfloServer needs to be buildable first
        const bootstrap = await serverBootstrap($context);
        const _outfiles = await generateServerScript({ $context, bootstrap, buildParams });
        outfiles.push(..._outfiles);
    }

    if (process.send) {
        process.send({ outfiles });
    }

    return { outfiles };
}