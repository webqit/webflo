export class CLIContext {

    constructor(dict, CD = null) {
        // dict can be plain object or some Context instance itself
        // Using it as only a prototype protects it from being mutated down here
        Object.defineProperty(this, 'dict', { value: Object.create(dict), });
        // Now, for enumerable props thet need to be enumerable, where no getter/setter on both instances
        for (let prop in this.dict) {
            if (prop in this) continue;
            this[prop] = this.dict[prop];
        }
        if (arguments.length > 1) {
            Object.defineProperty(this.dict, 'CWD', { get: () => CD });
        }
    }

    // create
    static create(...args) {
        return new this(...args);
    }

    // name
    get name() {
        return 'webflo';
    }

    // CWD
    get CWD() {
        return this.dict.CWD || '';
    }

    // meta
    get meta() {
        return this.dict.meta || {};
    }

    // appMeta
    get appMeta() {
        return this.dict.appMeta || {};
    }

    // config
    get config() {
        return this.dict.config || {};
    }

    // flags
    get flags() {
        return this.dict.flags || {};
    }

    set flags(value) {
        Object.defineProperty(this.dict, 'flags', { value } );
    }

    // layout
    get layout() {
        return this.dict.layout || {};
    }

    set layout(value) {
        Object.defineProperty(this.dict, 'layout', { value } );
    }

    // logger
    get logger() {
        return this.dict.logger || console;
    }

    set logger(value) {
        Object.defineProperty(this.dict, 'logger', { value } );
    }
}
