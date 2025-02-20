import { WebfloStorage } from '../WebfloStorage.js';

export class SessionStorage extends WebfloStorage {
    static create(request) {
        const registry = {
            async get(key) { return localStorage.getItem(key) },
            async set(key, value) { return localStorage.setItem(key, value) },
        };
        return new this(
            registry,
            'session',
            request,
            true
        );
    }
}