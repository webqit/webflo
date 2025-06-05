import Fs from 'fs';
import Path from 'path';
import Jsdom from 'jsdom';
import EsBuild from 'esbuild';
import { gzipSync, brotliCompressSync } from 'zlib';
import { _afterLast, _beforeLast } from '@webqit/util/str/index.js';
import { _isObject, _isArray } from '@webqit/util/js/index.js';
import { jsFile } from '@webqit/backpack/src/dotfile/index.js';
import { Context } from '../../Context.js';
import {
    readClientConfig,
    readWorkerConfig,
    readLayoutConfig,
    readEnvConfig,
    scanRoots,
    scanRouteHandlers,
} from '../../deployment-pi/util.js';
import '../webflo-url/urlpattern.js';

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

function declareRoutes({ $context, $config, $source, which, offset, roots = [] }) {
    const { logger: LOGGER } = $context;
    LOGGER?.log(LOGGER.style.keyword(`> `) + `Declaring routes...`);
    // Define vars
    const varName = 'routes';
    const targetDir = Path.join($config.LAYOUT.PUBLIC_DIR, offset);
    // >> Routes mapping
    $source.code.push(`const ${varName} = {};`);
    // Route entries
    let routeCount = 0;
    scanRouteHandlers($config.LAYOUT, which, (file, route, filename, fstat) => {
        // The "import" code
        const routeId = 'route' + (++routeCount);
        const importPath = Path.relative(targetDir, file);
        $source.imports[importPath] = '* as ' + routeId;
        // The route def
        $source.code.push(`${varName}['${route}'] = ${routeId};`);
        // Show
        LOGGER?.log(
            LOGGER.style.comment(`  [${route}]:   `) + LOGGER.style.url(importPath) + LOGGER.style.comment(` (${fstat.size / 1024} KB)`)
        );
    }, offset, roots);
    // >> Specials
    $source.code.push(`Object.defineProperty(${varName}, '$root', { value: '${offset}' });`);
    $source.code.push(`Object.defineProperty(${varName}, '$sparoots', { value: ${JSON.stringify(roots)} });`);
    if (!routeCount) {
        LOGGER?.log(LOGGER.style.comment(`  (none)`));
    }
}

function writeImportWebflo($source, which) {
    $source.imports[`@webqit/webflo/src/runtime-pi/webflo-${which}/index.js`] = `{ start }`;
}

function writeScriptBody({ $context, $config, $source, which, offset, roots, configExport }) {
    // >> Config
    $source.code.push(`// >> Config export`);
    declareConfig({ $source, configExport });
    $source.code.push(``);
    // >> Routes mapping
    $source.code.push(`// >> Routes`);
    declareRoutes({ $context, $config, $source, which, offset, roots });
    $source.code.push(``);
    // >> Startup
    $source.code.push(`// >> Startup`);
    $source.code.push(`self.webqit = self.webqit || {};`);
    $source.code.push(`self.webqit.app = await start.call({ config, routes })`);
}

async function bundleScript({ $context, $source, which, outfile, asModule = false, ...restParams }) {
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
        bundle: true,
        minify: true,
        banner: { js: '/** @webqit/webflo */', },
        footer: { js: '', },
        format: 'esm',
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

function handleEmbeds(embeds, targetDocumentFile) {
    if (!Fs.existsSync(targetDocumentFile)) return 0;
    const targetDocument = Fs.readFileSync(targetDocumentFile).toString();
    if (targetDocument.trim().startsWith('<!DOCTYPE html')) return 0;
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

async function generateClientScript({ $context, $config, offset = '', roots = [], ...restParams }) {
    const { flags: FLAGS, logger: LOGGER } = $context;
    // -----------
    const inSplitMode = !!roots.length || !!offset;
    const targetDocumentFile = Path.join($config.LAYOUT.PUBLIC_DIR, offset, 'index.html');
    // For when we're in split mode
    const outfile_theWebfloClient = $config.CLIENT.filename.replace(/\.js$/, '.webflo.js');
    const outfile_theWebfloClientPublic = Path.join($config.CLIENT.public_base_url, outfile_theWebfloClient);
    // For when we're monolith mode
    const outfile_mainBuild = Path.join(offset, $config.CLIENT.filename);
    const outfile_mainBuildPublic = Path.join($config.CLIENT.public_base_url, outfile_mainBuild);
    // The source code
    const $source = { imports: {}, code: [] };
    const embeds = { all: [], current: [] };
    // -----------
    // 1. Derive params
    const configExport = structuredClone({ CLIENT: $config.CLIENT, ENV: $config.ENV });
    if ($config.CLIENT.capabilities?.service_worker === true) {
        configExport.CLIENT.capabilities.service_worker = {
            filename: $config.WORKER.filename,
            scope: $config.WORKER.scope
        };
    }
    // 2. Add the Webflo Runtime
    const outfiles = [];
    if (inSplitMode) {
        if (!offset) {
            // We're building the Webflo client as a standalone script
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
                outfile: Path.join($config.LAYOUT.PUBLIC_DIR, outfile_theWebfloClient),
                asModule: true
            });
            outfiles.push(..._outfiles);
        }
        if (FLAGS['auto-embed']) {
            embeds.current.push(outfile_theWebfloClientPublic);
            embeds.current.push(outfile_mainBuildPublic);
        }
    } else {
        // We're building the Webflo client as part of the main script
        writeImportWebflo($source, 'client');
        if (FLAGS['auto-embed']) {
            embeds.current.push(outfile_mainBuildPublic);
        }
    }
    // 3. Write the body and bundle
    writeScriptBody({
        $context,
        $config,
        $source,
        which: 'client',
        offset,
        roots,
        configExport,
        ...restParams
    });
    // 4. Bundle
    const _outfiles = await bundleScript({
        $context,
        $source,
        which: 'client',
        outfile: Path.join($config.LAYOUT.PUBLIC_DIR, outfile_mainBuild),
        asModule: true,
        ...restParams
    });
    outfiles.push(..._outfiles);
    // 4. Embed/unembed
    embeds.all.push(outfile_theWebfloClientPublic);
    embeds.all.push(outfile_mainBuildPublic);
    handleEmbeds(embeds, targetDocumentFile);
    // -----------
    if (FLAGS.recursive && roots.length) {
        const $roots = roots.slice(0);
        const _outfiles = await generateClientScript({
            $context,
            $config,
            offset: $roots.shift(),
            roots: $roots,
            ...restParams
        });
        return outfiles.concat(_outfiles);
    }
    return outfiles;
}

async function generateWorkerScript({ $context, $config, offset = '', roots = [], ...restParams }) {
    const { flags: FLAGS } = $context;
    // -----------
    const outfile_mainBuild = Path.join(offset, $config.WORKER.filename);
    const $source = { imports: {}, code: [] };
    // -----------
    // 1. Derive params
    const configExport = structuredClone({ WORKER: $config.WORKER, ENV: $config.ENV });
    if ($config.CLIENT.capabilities?.webpush === true) {
        configExport.WORKER.capabilities = {
            webpush: true
        };
    }
    // Fetching strategies
    for (const strategy of ['cache_first_urls', 'cache_only_urls']) {
        if (configExport.WORKER[strategy].length) {
            // Separate URLs from patterns
            const [urls, patterns] = configExport.WORKER[strategy].reduce(([urls, patterns], url) => {
                const patternInstance = new URLPattern(url, 'http://localhost');
                const isPattern = patternInstance.isPattern();
                if (isPattern && (patternInstance.pattern.hostname !== 'localhost' || patternInstance.pattern.port)) {
                    throw new Error(`Pattern URLs must have no origin part. Recieved "${url}".`);
                }
                return isPattern ? [urls, patterns.concat(patternInstance)] : [urls.concat(url), patterns];
            }, [[], []]);
            // Resolve patterns
            if (patterns.length) {
                // List all files
                function scanDir(dir) {
                    Fs.readdirSync(dir).reduce((result, f) => {
                        const resource = Path.join(dir, f);
                        if (f.startsWith('.')) return result;
                        return result.concat(
                            Fs.statSync(resource).isDirectory() ? scanDir(resource) : '/' + Path.relative($config.LAYOUT.PUBLIC_DIR, resource)
                        );
                    }, []);
                }
                const files = scanDir($config.LAYOUT.PUBLIC_DIR);
                // Resolve patterns from files
                configExport.WORKER[strategy] = patterns.reduce((all, pattern) => {
                    const matchedFiles = files.filter((file) => pattern.test(file, 'http://localhost'));
                    if (matchedFiles.length) return all.concat(matchedFiles);
                    throw new Error(`The pattern "${pattern.pattern.pathname}" didn't match any files.`);
                }, urls);
            }
        }
    }
    // 2. Add the Webflo Runtime
    writeImportWebflo($source, 'worker');
    // 3. Write the body and bundle
    writeScriptBody({
        $context,
        $config,
        $source,
        which: 'worker',
        offset,
        roots,
        configExport,
        ...restParams
    });
    // 4. Bundle
    const outfiles = await bundleScript({
        $context,
        $source,
        which: 'worker',
        outfile: Path.join($config.LAYOUT.PUBLIC_DIR, outfile_mainBuild),
        asModule: false,
        ...restParams
    });
    // -----------
    if (FLAGS.recursive && roots.length) {
        const $roots = roots.slice(0);
        const _outfiles = await generateWorkerScript({
            $context,
            $config,
            offset: $roots.shift(),
            roots: $roots,
            ...restParams
        });
        return outfiles.concat(_outfiles);
    }
    return outfiles;
}

export async function generate({ client = true, worker = true, buildParams = {} } = {}) {
    const $context = this;
    if (!($context instanceof Context)) {
        throw new Error(`The "this" context must be a Webflo Context object.`);
    }
    // Resolve common details
    const $config = {
        LAYOUT: await readLayoutConfig($context),
        ENV: { ...await readEnvConfig($context), data: {} },
        CLIENT: await readClientConfig($context),
        WORKER: await readWorkerConfig($context),
    };
    if ($config.CLIENT.copy_public_variables) {
        const publicEnvPattern = /(?:^|_)PUBLIC(?:_|$)/;
        for (const key in process.env) {
            if (publicEnvPattern.test(key)) {
                $config.ENV.data[key] = process.env[key];
            }
        }
    }
    // Build
    const outfiles = [];
    if (client) {
        const documentRoots = scanRoots($config.LAYOUT.PUBLIC_DIR, 'index.html');
        const _outfiles = await generateClientScript({ $context, $config, roots: documentRoots, buildParams });
        outfiles.push(..._outfiles);
    }
    if (worker) {
        const applicationRoots = scanRoots($config.LAYOUT.PUBLIC_DIR, 'manifest.json');
        const _outfiles = await generateWorkerScript({ $context, $config, roots: applicationRoots, buildParams });
        outfiles.push(..._outfiles);
    }
    return { outfiles };
}