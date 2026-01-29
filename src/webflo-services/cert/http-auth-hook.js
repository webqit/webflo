#!/usr/bin/env node

/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import Layout from '../../webflo-config/deployment/Layout.js';

// ------------------------------------------

const domain = process.env.CERTBOT_DOMAIN,
    validation = process.env.CERTBOT_VALIDATION,
    token = process.env.CERTBOT_TOKEN,
    remainingChallenges = process.env.CERTBOT_REMAINING_CHALLENGES || 0/*,
    allDomains = process.env.CERTBOT_ALL_DOMAINS.split(',')*/
    ;
(async function() {
    const layout = await (new Layout({ name: 'webflo', flags: {} })).read();
    const acmeDir = Path.join(layout.PUBLIC_DIR, './.well-known/acme-challenge/');
    Fs.mkdirSync(acmeDir, {recursive:true});
    Fs.writeFileSync(Path.join(acmeDir, token), validation);
})();
