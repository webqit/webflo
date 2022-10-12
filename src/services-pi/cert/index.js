
/**
 * imports
 */
import Fs from 'fs';
import { spawn } from 'child_process';
import { _from as _arrFrom } from '@webqit/util/arr/index.js';

/**
 * @description
 */
export const desc = {
    generate: 'Generate an SSL cert for a domain or list of domains.',
};

/**
 * Reads SSL from file.
 * 
 * @param string    allDomains
 * 
 * @return object
 */
export async function generate(allDomains) {
    const cx = this || {};
    if (!cx.config.runtime?.Server) {
        throw new Error(`The Server configurator "config.runtime.Server" is required in context.`);
    }
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
        if (cx.logger) {
            cx.logger.log('[' + cx.logger.style.keyword('CERTBOT') + '][' + cx.logger.style.var('OUT') + ']:', data + '');
        }
    });

    child.stderr.on('data', data => {
        if (cx.logger) {
            cx.logger.log('[' + cx.logger.style.keyword('CERTBOT') + '][' + cx.logger.style.err('ERR') + ']:', (data + '').trim());
        }
    });
    
    child.on('error', data => {
        cx.logger && cx.logger.error(data);
        process.exit();
    });

    child.on('exit', async exitCode => {
        const serverConfig = new cx.config.runtime.Server(cx);
        const server = await serverConfig.read();
        const domain = domains[0], certDir = `/etc/letsencrypt/live/${domain}`;
        if (!exitCode && cx.flags && (cx.flags['auto-config'] || cx.flags.c)) {
            if (Fs.existsSync(certDir)) {
                cx.logger && cx.logger.log('Automatically configuring the server with the generated cert.');
                if (!server.https) {
                    server.https = {};
                }
                server.https.keyfile = `${certDir}/privkey.pem`;
                server.https.certfile = `${certDir}/fullchain.pem`;
                await serverConfig.write(server);
            } else {
                cx.logger && cx.logger.log(`Generated cert files not found in ${certDir}; be sure to configure the server with the valid cert files.`);
            }
        }
        process.exit();
    });

}