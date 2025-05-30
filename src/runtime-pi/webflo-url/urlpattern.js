import { _isNumeric } from '@webqit/util/js/index.js';
if (typeof URLPattern === 'undefined') {
    await import('urlpattern-polyfill');
}

const { exec: execMethod } = URLPattern.prototype;
const urlPatternMethods = {
    isPattern: {
        value: function () {
            return Object.keys(this.keys || {}).some((compName) => this.keys[compName].length);
        }
    },
    exec: {
        value: function (...args) {
            let components = execMethod.call(this, ...args);
            if (!components) return;
            components.vars = Object.keys(this.keys).reduce(({ named, unnamed }, compName) => {
                this.keys[compName].forEach(key => {
                    let value = components[compName].groups[key.name];
                    if (typeof key.name === 'number') {
                        unnamed.push(value);
                    } else {
                        named[key.name] = value;
                    }
                });
                return { named, unnamed };
            }, { named: {}, unnamed: [] });
            components.render = (str) => {
                return str.replace(/\$(\$|[0-9A-Z]+)/gi, (a, b) => {
                    return b === '$' ? '$' : (_isNumeric(b) ? components.vars.unnamed[b - 1] : components.vars.named[b]) || '';
                });
            }
            return components;
        }
    },
};

Object.defineProperties(URLPattern.prototype, urlPatternMethods);
