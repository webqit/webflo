import { HttpKeyvalInterface } from './HttpKeyvalInterface.js';

export class HttpCookies101 extends HttpKeyvalInterface {

    #initial;

    constructor({ context = {}, store, initial = {}, realm = 0 }) {
        super({ context, store, initial, realm });
        this.#initial = initial;
    }

    // ------ lifecycle

    async _commit(response, devMode = false) {
        // Mutate in-place - to reflect across clones
        Object.keys(this.#initial).forEach((k) => delete this.#initial[k]);
        Object.assign(this.#initial, await this.json());
    }

    // ------ extras

    async render() {
        const json = await this.json({ meta: true });

        const entries = Object.keys(json).concat(Object.keys(this.#initial)).map((key) => {
            const a = this.#initial[key];
            const b = json[key];
            if (a === b.value) {
                // Same
                return;
            }
            if ([undefined, null].includes(b)) {
                // Deleted
                return { name: key, value: '', maxAge: 0 };
            }
            // Added or modified
            return { name: key, ...b };
        }).filter((e) => e);

        return entries.map((e) => renderCookieObjToString(e));
    }
}

export function renderCookieObjToString(cookieObj) {
    const attrsArr = [`${cookieObj.name}=${/*encodeURIComponent*/(cookieObj.value)}`];
    for (const attrName in cookieObj) {
        if (['name', 'value'].includes(attrName)) continue;
        
        let _attrName = attrName[0].toUpperCase() + attrName.substring(1);
        if (_attrName === 'MaxAge') { _attrName = 'Max-Age' };

        if (cookieObj[attrName] === false) continue;
        attrsArr.push(cookieObj[attrName] === true ? _attrName : `${_attrName}=${cookieObj[attrName]}`);
    }
    return attrsArr.join('; ');
}