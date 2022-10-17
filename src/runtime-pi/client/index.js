
/**
 * @imports
 */
import Context from './Context.js';
import RuntimeClient from './RuntimeClient.js';
import Runtime from './Runtime.js';

/**
 * @start
 */
export async function start(clientCallback = null) {
    const cx = this || {};
    const defaultClientCallback = _cx => new RuntimeClient(_cx);
    return new Runtime(Context.create(cx), clientCallback || defaultClientCallback);
}

/**
 * @APIS
 */
export * as APIS from './Runtime.js';
