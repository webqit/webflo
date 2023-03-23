
/**
 * @imports
 */
import _Context from '../../Context.js';

export default class Context extends _Context {
    // env
    get env() {
        return this.dict.env || {};
    }

    set env(value) {
        this.dict.env = value;
    }
}