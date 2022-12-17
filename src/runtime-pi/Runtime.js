
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
    constructor(cx, applicationInstance) {
        this.cx = cx;
        this.cx.runtime = this;
        this.app = _isFunction(applicationInstance) ? applicationInstance(this.cx) : applicationInstance;
        if (!this.app || !this.app.handle) throw new Error(`Application instance must define a ".handle()" method.`);
    }
}