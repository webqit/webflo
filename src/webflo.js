#!/usr/bin/env node

/**
 * @imports
 */
import Url from 'url';
import Path from 'path';
import { read as readJsonFile } from '@webqit/backpack/src/dotfiles/DotJson.js';
import logger from '@webqit/backpack/src/cli/Ui.js';
import * as WebfloPI from './index.js';
import Context from './Context.js';
import Cli from './Cli.js';

const dirSelf = Path.dirname(Url.fileURLToPath(import.meta.url));
const webfloJson = readJsonFile(Path.join(dirSelf, '../package.json'));
const appJson = readJsonFile('./package.json');

/**
 * @cx
 */
const cx = Context.create({
    webflo: { title: webfloJson.title, version: webfloJson.version },
    app: { title: appJson.title, version: appJson.version },
    logger,
    config: WebfloPI.config,
    middlewares: [ WebfloPI.deployment.origins.webhook, ],
});

/**
 * @cli
 */
const cli = new Cli(WebfloPI);
await cli.exec(cx);
