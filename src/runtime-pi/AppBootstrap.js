import { CLIContext } from '../CLIContext.js';

export class AppBootstrap {

    #json;
    #cx;
    #init;

    constructor(json = {}) {
        this.#json = json;
        this.#cx = new CLIContext(json.cx || {});
        this.#init = { ...(json.init || {})};
    }

    // cx
    get cx() { return this.#cx; }

    // init
    get init() { return this.#init; }

    // $root
    get $root() { return this.#json.offset || ''; }

    // $roots
    get $roots() { return this.#json.$roots || []; }

    // $sparoots
    get $sparoots() { return this.#json.$sparoots || []; }

    // config
    get config() { return this.#json.config || {}; }

    // routes
    get routes() { return this.#json.routes || {}; }

    // middlewares
    get middlewares() { return this.#json.middlewares || []; }
}
