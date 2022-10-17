
/**
 * @imports
 */

import { _isFunction } from "@webqit/util/js/index.js";

/**
 * ---------------------------
 * The base Runtime class
 * ---------------------------
 */
            
export default class Runtime {
    constructor(cx, client) {
        this.cx = cx;
        this.cx.runtime = this;
        this.client = _isFunction(client) ? client(this.cx) : client;
        if (!this.client || !this.client.handle) throw new Error(`Application instance must define a ".handle()" method.`);
    }
}