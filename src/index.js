#!/usr/bin/env node

/**
 * imports
 */
import _isEmpty from '@webqit/util/js/isEmpty.js';
import _merge from '@webqit/util/obj/merge.js';
import parseArgs from '@webqit/backpack/src/cli/parseArgs.js';
import Ui from '@webqit/backpack/src/cli/Ui.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';
import { Promptx } from '@webqit/backpack/src/cli/Promptx.js';
import * as config from './config/index.js';
import * as cmd from './cmd/index.js';

// ------------------------------------------

const commands = {
    config: 'Starts a configuration process.',
    build: cmd.client.desc.build,
    deploy: cmd.origins.desc.deploy,
    ...cmd.server.desc,
};

// ------------------------------------------

const { command, keywords, flags, options, ellipsis } = parseArgs(process.argv);

// ------------------------------------------

console.log('');

(async function() {
    const layout = await config.layout.read({});
    layout.PKG = DotJson.read('./package.json');
    switch(command) {

        // --------------------------

        case 'build':
            cmd.client.build(Ui, flags, layout);
        break;

        // --------------------------

        case 'deploy':
            var origin = Object.keys(keywords)[0],
                options;
            // ----------------
            if (!origin && ellipsis) {
                if (!(options = (await config.origins.read(flags, layout)).REPOS) || _isEmpty(options)) {
                    Ui.log(Ui.f`Please configure an origin (${'webflo config ...'}) to use the ${'deploy'} command.`);
                    return;
                }
                origin = await Promptx({
                    name: 'origin',
                    type: 'select',
                    choices: options.map(r => ({value: r.TAG})),
                    message: 'Please select a origin',
                }).then(d => d.origin);
            }
            if (!origin) {
                Ui.log(Ui.f`Please add an origin name to the ${command} command. For options, use the ellipsis ${'...'}`);
                return;
            }
            // ----------------
            cmd.origins.deploy(Ui, origin, flags, layout);
        break;

        // --------------------------

        case 'start':
           cmd.server.start(Ui, flags, layout);
        break;
        
        case 'stop':
        case 'restart':
            var runtime = Object.keys(keywords)[0];
            // ----------------
            if (!runtime && ellipsis) {
                runtime = await Promptx({
                    name: 'runtime',
                    type: 'select',
                    choices: (await cmd.server.processes(Ui)).map(r => ({title: r.name, description: r.status, value: r.name})).concat({description: 'All of the above', value: 'all'}),
                    message: 'Please select a runtime name',
                }).then(d => d.runtime);
            }
            // ----------------
            await cmd.server[command](Ui, runtime || 'all', flags);
            process.exit();
        break;

        case 'processes':
            const processes = await cmd.server.processes(Ui, flags);
            Ui.title(`SERVERS`);
            if (processes.length) {
                processes.forEach(service => {
                    Ui.log(Ui.f`> ${service}`);
                });
            } else {
                Ui.log(Ui.f`> (empty)`);
            }
            process.exit();
        break;

        // --------------------------

        case 'config':
            
            var domain = Object.keys(keywords)[0];
            // ----------------
            if (!domain && ellipsis) {
                domain = await Promptx({
                    name: 'domain',
                    type: 'select',
                    choices: Object.keys(config).map(c => ({value: c})),
                    message: 'Please select a configuration domain',
                }).then(d => d.domain);
            }
            if (!domain || !config[domain]) {
                Ui.log(Ui.f`Please add a configuration domain to the ${command} command. For options, use the ellipsis ${'...'}`);
                return;
            }
            // ----------------
            const data = await config[domain].read(flags, layout);
            Promptx(await config[domain].questions(data, {}, layout)).then(async _data => {
                await config[domain].write(_merge(data, _data), flags, layout);
            });

        break;

        // --------------------------

        case 'cert':
            var domains = Object.keys(keywords);
           cmd.certbot.generate(Ui, domains, flags, layout);
        break;
        
        case 'help':
        default:
            Ui.title(`NAVIGATOR HELP`);
            Ui.log('');
            Ui.log(Ui.f`Say ${'webflo'} <${'command'}>`);
            Ui.log('');
            Ui.log(Ui.f`Where <${'command'}> is one of:`);
            Ui.log(Ui.f`${commands}`);
            Ui.log('');
            Ui.log(Ui.f`You may also refer to the Webflo DOCS as ${'https://webqit.io/tooling/webflo'}`);
    }    
})();
