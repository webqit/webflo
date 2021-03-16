#!/usr/bin/env node

/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import * as _setup from '../../config/setup.js';

// ------------------------------------------

const domain = process.env.CERTBOT_DOMAIN,
    validation = process.env.CERTBOT_VALIDATION,
    token = process.env.CERTBOT_TOKEN,
    remainingChallenges = process.env.CERTBOT_REMAINING_CHALLENGES || 0/*,
    allDomains = process.env.CERTBOT_ALL_DOMAINS.split(',')*/
    ;
(async function() {
    const setup = await _setup.read({});
    const acmeDir = Path.join(setup.PUBLIC_DIR, './.well-known/acme-challenge/');
    Fs.mkdirSync(acmeDir, {recursive:true});
    Fs.writeFileSync(Path.join(acmeDir, token), validation);
})();