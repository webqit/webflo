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
const webfloJson = jsonFile.read(Path.join(dirSelf, '../package.json'));
const appJson = jsonFile.read('./package.json');

/**
 * @cx
 */
const cx = WebfloPI.Context.create({
    meta: { title: webfloJson.title, version: webfloJson.version },
    app: { title: appJson.title, version: appJson.version },
    logger: Logger,
    config: WebfloPI.config,
    middlewares: [ WebfloPI.deployment.origins.webhook, ],
});

/**
 * @cli
 */
const cli = new Cli(WebfloPI);
await cli.exec(cx);
