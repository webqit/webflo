import Fs from 'fs';
import Fs2 from 'fs/promises';
import Path from 'path';
import { exec } from 'child_process';
import { _toTitle } from '@webqit/util/str/index.js';
import { readInitConfig } from '../deployment-pi/util.js';
import { CLIContext } from '../CLIContext.js';
import * as deployment from '../deployment-pi/index.js';

export const desc = {
    init: 'Generate a preset Webflo starter app.',
};

export async function init(projectName = 'my-webflo-app', projectTitle = '', projectDescription = '') {
    const $context = this;
    //middlewares: [ deployment.origins.webhook ],


    if (!($context instanceof CLIContext)) {
        throw new Error(`The "this" context must be a Webflo CLIContext object.`);
    }

    const { flags: FLAGS, logger: LOGGER } = $context;
    const $config = {
        INIT: await readInitConfig($context),
    };

    // Validate chosen tamplate
    const template = FLAGS.template || $config.INIT.template;
    const templateDir = Path.resolve(new URL(import.meta.url).pathname, '../templates', template);
    if (!Fs.existsSync(templateDir)) {
        LOGGER?.error(LOGGER.style.err(`Error: template "${template}" not found.`));
        process.exit(1);
    }

    // Validate target dir
    const targetDir = Path.resolve(process.cwd(), projectName);
    if (Fs.existsSync(targetDir)) {
        LOGGER?.error(LOGGER.style.err(`Error: directory ${projectName} already exists.`));
        process.exit(1);
    }

    LOGGER?.log(LOGGER.style.keyword(`> `) + `Initializing your webflo app "${projectName}" using template "${template}"...\n`);

    // 1. Create project dir
    await Fs2.mkdir(targetDir, { recursive: true });
    // 2. Copy template files
    await Fs2.cp(templateDir, targetDir, { recursive: true });

    if (!projectTitle) {
        projectTitle = _toTitle(projectName.replace(/-/g, ' '));
    }
    if (!projectDescription) {
        projectDescription = `${projectTitle} - powered by Webflo`;
    }

    // 3. Customize package.json
    const pkgFile = Path.join(targetDir, 'package.json');
    if (Fs.existsSync(pkgFile)) {
        const pkgData = JSON.parse(await Fs2.readFile(pkgFile, 'utf8'));
        pkgData.name = projectName;
        pkgData.title = projectTitle;
        pkgData.description = projectDescription;
        await Fs2.writeFile(pkgFile, JSON.stringify(pkgData, null, 2));
    }

    // 4. Customize index.html and manifest.json
    for (const fileName of ['public/index.html', 'public/manifest.json']) {
        const filePath = Path.join(targetDir, fileName);
        if (Fs.existsSync(filePath)) {
            let fileContents = await Fs2.readFile(filePath, 'utf8');
            fileContents = fileContents.replace(/APP_NAME/g, projectName);
            fileContents = fileContents.replace(/APP_TITLE/g, projectTitle);
            fileContents = fileContents.replace(/APP_DESCRIPTION/g, projectDescription);
            await Fs2.writeFile(filePath, fileContents);
        }
    }

    // 5. Run setup commands
    const comands = [];
    const nextSteps = [];
    if (FLAGS.install ?? $config.INIT.install) {
        comands.push('npm install');
        comands.push('npm run build');
    } else {
        nextSteps.push('npm install');
    }
    if (FLAGS.git ?? $config.INIT.git) {
        comands.push('git init');
    } else {
        nextSteps.push('git init');
    }
    if (comands.length) {
        LOGGER?.log(LOGGER.style.keyword(`> `) + `Running setup commands...`);
        for (const cmd of comands) {
            LOGGER?.log(LOGGER.style.token(`$ `) + cmd);
            await new Promise((resolve, reject) => {
                exec(cmd, { cwd: targetDir }, (error, stdout, stderr) => {
                    if (error) {
                        LOGGER?.log(LOGGER.style.err(stderr || error.message));
                        return reject(error);
                    }
                    resolve();
                });
            });
        }
    }

    // 6. Done message
    LOGGER?.log(`\n✔ Successfully created "${projectName}" using template "${template}"`);
    LOGGER?.log(`\nNext steps:`);
    LOGGER?.log(`  cd ${projectName}`);
    if (nextSteps.length) {
        LOGGER?.log(`  # Additional setup commands:`);
        for (const step of nextSteps) {
            LOGGER?.log(`  ${step}`);
        }
    }
    LOGGER?.log(`  npm run dev -- --open\n`);
}