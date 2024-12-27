import { _isObject } from '@webqit/util/js/index.js';
import { _even } from '@webqit/util/obj/index.js';

export class AbstractStorage extends Map {
    
    #originals;
    
    constructor(iterable = []) {
        super(iterable);
        this.saveOriginals();
    }
    
    saveOriginals() { this.#originals = new Map(this); }

    getOriginals() { return this.#originals; }

    getDeleted() {
        if (!this.#originals) return [];
        return [...this.#originals.keys()].filter((k) => {
            return !this.has(k);
        });
    }

    getAdded() {
        if (!this.#originals) return [...this.keys()];
        return [...new Set([...this.keys(), ...this.#originals.keys()])].filter((k) => {
            return !this.#originals.has(k) || (this.has(k) && ((a, b) => _isObject(a) && _isObject(b) ? !_even(a, b) : a !== b)(this.get(k, true), this.#originals.get(k)));
        });
    }
}