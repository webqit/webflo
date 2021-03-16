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
    authOutput = process.env.CERTBOT_AUTH_OUTPUT,
    remainingChallenges = process.env.CERTBOT_REMAINING_CHALLENGES || 0/*,
    allDomains = process.env.CERTBOT_ALL_DOMAINS.split(',')*/
    ;
(async function() {
    const setup = await _setup.read({});
    const acmeFile = Path.join(setup.PUBLIC_DIR, './.well-known/acme-challenge/', token);
    Fs.unlinkSync(acmeFile);
})();