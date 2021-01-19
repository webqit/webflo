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
import * as client from './config/client.js';
import * as manifest from './config/manifest.js';
import * as prerendering from './config/prerendering.js';
import * as redirects from './config/redirects.js';
import * as origins from './config/origins.js';
import * as server from './config/server.js';
import * as variables from './config/variables.js';
import * as vhosts from './config/vhosts.js';
import * as CMDclient from './cmd/client.js';
import * as CMDorigins from './cmd/origins.js';
import * as CMDserver from './cmd/server.js';

// ------------------------------------------

const PKG = DotJson.read('./package.json');
const params = {
    ROOT: process.cwd(),
    PKG,
};

// ------------------------------------------

const commands = {
    config: 'Starts a configuration processes.',
    build: CMDclient.desc.build,
    deploy: CMDorigins.desc.deploy,
    ...CMDserver.desc,
};

// ------------------------------------------

const { command, keywords, flags, options, ellipsis } = parseArgs(process.argv);

// ------------------------------------------

console.log('');

(async function() {
    switch(command) {

        // --------------------------

        case 'build':
            CMDclient.build(Ui, params);
        break;

        // --------------------------

        case 'deploy':
            var origin = Object.keys(keywords)[0],
                options;
            // ----------------
            if (!origin && ellipsis) {
                if (!(options = (await origins.read(params)).REPOS) || _isEmpty(options)) {
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
            CMDorigins.deploy(Ui, origin, params);
        break;

        // --------------------------

        case 'start':
            CMDserver.start(Ui, flags, params);
        break;
        
        case 'stop':
        case 'restart':
            var runtime = Object.keys(keywords)[0];
            // ----------------
            if (!runtime && ellipsis) {
                runtime = await Promptx({
                    name: 'runtime',
                    type: 'select',
                    choices: (await CMDserver.processes(Ui)).map(r => ({title: r.name, description: r.status, value: r.name})).concat({description: 'All of the above', value: 'all'}),
                    message: 'Please select a runtime name',
                }).then(d => d.runtime);
            }
            if (!runtime) {
                Ui.log(Ui.f`Please add a runtime name, or ${'all'}, to the ${command} command. For options, use the ellipsis ${'...'}`);
                return;
            }
            // ----------------
            await CMDserver[command](Ui, runtime, flags);
            process.exit();
        break;

        case 'processes':
            const processes = await CMDserver.processes(Ui, flags);
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
            
            // config
            const config = {
                client,
                manifest,
                prerendering,
                redirects,
                rdr: redirects,
                origins,
                origins: origins,
                server,
                variables,
                vars: variables,
                vhosts,
            };
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
            const data = await config[domain].read(params);
            Promptx(await config[domain].questions(data, {}, params)).then(async _data => {
                await config[domain].write(_merge(data, _data), params);
            });

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
