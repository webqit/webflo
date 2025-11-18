#!/usr/bin/env node

/**
 * @imports
 */
import Url from 'url';
import Path from 'path';
import { jsonFile } from '@webqit/backpack/src/dotfile/index.js';
import { Logger, Cli } from '@webqit/backpack';
import * as WebfloPI from './index.js';

const dirSelf = Path.dirname(Url.fileURLToPath(import.meta.url));
const webfloMeta = jsonFile.read(Path.join(dirSelf, '../package.json'));
const appMeta = jsonFile.read('./package.json');

/**
 * @cx
 */
const cx = WebfloPI.CLIContext.create({
    meta: { title: webfloMeta.title, version: webfloMeta.version },
    appMeta: { ...appMeta },
    logger: Logger,
    config: WebfloPI.config,
});

/**
 * @cli
 */
const cli = new Cli(WebfloPI);
await cli.exec(cx);
