
/**
 * @imports
 */
import Path from 'path';
import { _merge } from '@webqit/util/obj/index.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import { DotJson, DotEnv, anyExists } from '@webqit/backpack/src/dotfiles/index.js';

/**
 * @exports
 */
export default class Configurator {

    /**
     * The default initializer.
     * 
     * @param Context cx
     */
    constructor(cx) {
        this.cx = cx;
        this.givenExt = this.cx.flags.mode ? `.${this.cx.flags.mode}` : '';
        this.availableExt = anyExists([ this.givenExt, '', '.example' ], ext => this.resolveFileName(ext));
        if (this.isEnv) {
            this.availableEnvExt = anyExists([ this.givenExt, '', '.example' ], ext => this.resolveEnvFileName(ext));
        }
    }

    // ------------

    get configDir() {
        return Path.join(this.cx.CWD || ``, `./.webqit/webflo/config/`);
    }

    get envDir() {
        return Path.resolve(this.cx.CWD || '');
    }

    // ------------

    static read(...args) {
        let instance = new this(...args);
        return instance.read();
    }


    static write(config, ...args) {
        let instance = new this(...args);
        return instance.write(config);
    }

    // ------------

    async read() {
        let config = DotJson.read(this.resolveFileName(this.availableExt));
        if (this.isEnv) {
            let config2 = { entries: DotEnv.read(this.resolveEnvFileName(this.availableEnvExt)) || {}, };
            // The rewrite below is because entries should not also appear in json
            //config.entries = _merge(config.entries || {}, config2.entries);
            config = _merge(config, config2);
        }
        return this.withDefaults(config);
    }

    async write(config) {
        if (this.isEnv) {
            config = { ...config };
            DotEnv.write(config.entries, this.resolveEnvFileName(this.givenExt));
            // The delete below is because entries should not also appear in json
            delete config.entries;
        }
        DotJson.write(config, this.resolveFileName(this.givenExt));
    }

    questions() {
        return [];
    }

    // ------------

    resolveFileName(ext) {
        return `${this.configDir}/${this.name}${ext}.json`;
    }

    resolveEnvFileName(ext) {
        return `${this.envDir}/.${this.name}${ext}`;
    }

    withDefaults(config) {
        return config;
    }

    indexOfInitial(options, initial) {
        return initialGetIndex(options, initial);
    }

}