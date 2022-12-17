
/**
 * @imports
 */
import Context from './Context.js';
import Application from './Application.js';
import Runtime from './Runtime.js';

/**
 * @start
 */
export async function start(applicationInstance = null) {
    const cx = this || {};
    const defaultApplicationInstance = _cx => new Application(_cx);
    return new Runtime(Context.create(cx), applicationInstance || defaultApplicationInstance);
}

/**
 * @APIS
 */
export * as APIS from './Runtime.js';
