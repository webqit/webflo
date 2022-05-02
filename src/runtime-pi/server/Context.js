
/**
 * @imports
 */
import _Contex from '../../Context.js';

export default class Context extends _Contex {
    // env
    get env() {
        return this.dict.env || {};
    }

    set env(value) {
        this.dict.env = value;
    }
}