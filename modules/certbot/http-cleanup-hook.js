#!/usr/bin/env node

/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import * as _layout from '../../config/layout.js';

// ------------------------------------------

const domain = process.env.CERTBOT_DOMAIN,
    validation = process.env.CERTBOT_VALIDATION,
    token = process.env.CERTBOT_TOKEN,
    authOutput = process.env.CERTBOT_AUTH_OUTPUT,
    remainingChallenges = process.env.CERTBOT_REMAINING_CHALLENGES || 0/*,
    allDomains = process.env.CERTBOT_ALL_DOMAINS.split(',')*/
    ;
(async function() {
    const layout = await _layout.read({});
    const acmeFile = Path.join(layout.PUBLIC_DIR, './.well-known/acme-challenge/', token);
    Fs.unlinkSync(acmeFile);
})();