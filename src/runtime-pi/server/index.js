
/**
 * @imports
 */
import Context from './Context.js';
import RuntimeClient from './RuntimeClient.js';
import Runtime from './Runtime.js';

/**
 * @desc
 */
export const desc = {
    config: {
        headers: 'Configure automatic http headers.',
        prerendering: 'Configure prerendering.',
        redirects: 'Configure automatic redirects.',
        server: 'Configure server settings.',
        vhosts: 'Configure virtual hosts.',
    },
    start: 'Starts the Webflo server.',
};

/**
 * @start
 */
export async function start(clientCallback = null) {
    const cx = this || {};
    const defaultClientCallback = _cx => new RuntimeClient(_cx);
    return new Runtime(Context.create(cx), ( ...args ) => {
        return clientCallback ? clientCallback( ...args.concat( defaultClientCallback ) ) : defaultClientCallback( ...args );
    });
}

/**
 * @exports
 */
export {
    Context,
    RuntimeClient,
    Runtime,
}
