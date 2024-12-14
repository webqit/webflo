import AbstractStorage from '../AbstractStorage.js';
import Sessions from 'client-sessions';

export default class SessionStorage extends AbstractStorage {
    static create(request, detail, options = {}) {
        if (!(detail.request && detail.response)) return new this;
        Sessions({
            duration: 0,                                                    // how long the session will stay valid in ms
            activeDuration: 0,                                              // if expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
            ...options,
            cookieName: '_session',                                         // cookie name dictates the key name added to the request object
            secret: options.secret || 'unsecureSecret',                     // should be a large unguessable string
        })(detail.request, detail.response, (e) => { if (e) throw e; });
        return new this(Object.entries(detail.request._session));
    }

    commit(response, detail) {
        if (!detail.request?._session) return;
        for (const key of this.getAdded()) {
            detail.request._session[key] = this.get(key);
        }
        for (const key of this.getDeleted()) {
            delete detail.request._session[key];
        }
    }
}