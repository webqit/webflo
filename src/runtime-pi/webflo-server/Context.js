import { AbstractContext } from '../../AbstractContext.js';

export class Context extends AbstractContext {
    // env
    get env() {
        return this.dict.env || {};
    }

    set env(value) {
        this.dict.env = value;
    }
}