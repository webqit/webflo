
/**
 * imports
 */
import Fs from 'fs';
import Readline from 'readline';
import { spawn } from 'child_process';
import _arrFrom from '@webqit/util/arr/from.js';
import * as _layout from '../config/layout.js';
import * as _server from '../config/server.js';

/**
 * @description
 */
export const desc = {
    generate: 'Deploys a remote origin into the local directory.',
};

/**
 * Reads SSL from file.
 * 
 * @param Ui        Ui
 * @param string    allDomains
 * @param object    flags
 * @param object    layout
 * 
 * @return object
 */
export async function generate(Ui, allDomains, flags = {}, layout = {}) {
    const domains = _arrFrom(allDomains).reduce((all, d) => all.concat(d.split(',')), []).filter(d => d.trim());
    const args = [
        'certonly',
        '--manual',
        '--preferred-challenges', 'http', 
    ].concat(domains.reduce((all, d) => all.concat('-d', d), []))
    .concat([
        '--manual-auth-hook', 'webflo-certbot-http-auth-hook',
        '--manual-cleanup-hook', 'webflo-certbot-http-cleanup-hook',
        '--debug-challenges',
        '--force-interactive',
    ]);
    const child = spawn('certbot', args);
    process.stdin.pipe(child.stdin);

    child.stdout.on('data', data => {
        Ui.log('[' + Ui.style.keyword('CERTBOT') + '][' + Ui.style.var('OUT') + ']:', data + '');
    });

    child.stderr.on('data', data => {
        Ui.log('[' + Ui.style.keyword('CERTBOT') + '][' + Ui.style.err('ERR') + ']:', (data + '').trim());
    });
    
    child.on('error', data => {
        Ui.error(data);
        process.exit();
    });

    child.on('exit', async exitCode => {
        const layout = await _layout.read({});
        const server = await _server.read(layout);
        const domain = domains[0], certDir = `/etc/letsencrypt/live/${domain}`;
        if (!exitCode && (flags['auto-config'] || flags.c)) {
            if (Fs.existsSync(certDir)) {
                Ui.log('Automatically configuring the server with the generated cert.');
                if (!server.https) {
                    server.https = {};
                }
                server.https.keyfile = `${certDir}/privkey.pem`;
                server.https.certfile = `${certDir}/fullchain.pem`;
                await _server.write(server);
            } else {
                Ui.log(`Generated cert files not found in ${certDir}; be sure to configure the server with the valid cert files.`);
            }
        }
        process.exit();
    });
};