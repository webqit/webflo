
/**
 * @imports
 */
import Context from './Context.js';
import WorkerClient from './WorkerClient.js';
import Worker from './Worker.js';

/**
 * @start
 */
export async function start(clientCallback = null) {
    const cx = this || {};
    const defaultClientCallback = _cx => new WorkerClient(_cx);
    return new Worker(Context.create(cx), ( ...args ) => {
        return clientCallback ? clientCallback( ...args.concat( defaultClientCallback ) ) : defaultClientCallback( ...args );
    });
}

/**
 * @APIS
 */
export * as APIS from './Worker.js';
