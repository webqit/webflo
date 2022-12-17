
/**
 * @imports
 */
import { _isString, _isNumeric, _isArray, _isTypeObject } from '@webqit/util/js/index.js';
if (typeof URLPattern === 'undefined') {
    await import('urlpattern-polyfill');
}

export const params = {
    // Parse a search params string into an object
    parse(str, delim = '&') {
        str = str || '';
        const target = {};
        (str.startsWith('?') ? str.substr(1) : str)
            .split(delim).filter(q => q).map(q => q.split('=').map(q => q.trim()))
            .forEach(q => this.set(target, q[0], decodeURIComponent(q[1])));
        return target;
    },
    // Stringify an object into a search params string
    stringify(targetObject, delim = '&') {
        const q = [];
        Object.keys(targetObject).forEach(key => {
            this.reduceValue(targetObject[key], key, (_value, _pathNotation, suggestedKeys = undefined) => {
                if (suggestedKeys) return suggestedKeys;
                q.push(`${_pathNotation}=${encodeURIComponent(_value)}`);
            });
        });
        return q.join(delim);
    },

    // Get value by path notation
    get(targetObject, pathNotation) {
        return this.reducePath(pathNotation, targetObject, (key, _targetObject) => {
            if (!_targetObject && _targetObject !== 0) return;
            return _targetObject[key];
        });
    },
    // Set value by path notation
    set(targetObject, pathNotation, value) {
        this.reducePath(pathNotation, targetObject, function(_key, _targetObject, suggestedBranch = undefined) {
            let _value = value;
            if (suggestedBranch) { _value = suggestedBranch; }
            if (_key === '' && _isArray(_targetObject)) {
                _targetObject.push(_value);
            } else {
                _targetObject[_key] = _value;
            }
            return _value;
        });
    },
    
    // Resolve a value to its leaf nodes
    reduceValue(value, contextPath, callback) {
        if (_isTypeObject(value)) {
            let suggestedKeys = Object.keys(value);
            let keys = callback(value, contextPath, suggestedKeys);
            if (_isArray(keys)) {
                return keys.forEach(key => {
                    this.reduceValue(value[key], contextPath ? `${contextPath}[${key}]` : key, callback);
                });
            }
        }
        callback(value, contextPath);
    },
    // Resolve a path to its leaf index
    reducePath(pathNotation, contextObject, callback) {
        if (_isString(pathNotation) && pathNotation.endsWith(']') && _isTypeObject(contextObject)) {
            let [ key, ...rest ] = pathNotation.split('[');
            if (_isNumeric(key)) { key = parseInt(key); }
            rest = rest.join('[').replace(']', '');
            let branch;
            if (key in contextObject) {
                branch = contextObject[key];
            } else {
                let suggestedBranch = rest === '' || _isNumeric(rest.split('[')[0]) ? [] : {};
                branch = callback(key, contextObject, suggestedBranch);
            }
            return this.reducePath(rest, branch, callback);
        }
        if (_isNumeric(pathNotation)) { pathNotation = parseInt(pathNotation); }
        return callback(pathNotation, contextObject);
    },    
};

export const path = {
    join(/* path segments */) {
        // Split the inputs into a list of path commands.
        var parts = [], backsteps = 0;
        for (var i = 0, l = arguments.length; i < l; i++) {
            parts = parts.concat(arguments[i].split("/"));
        }
        // Interpret the path commands to get the new resolved path.
        var newParts = [];
        for (i = 0, l = parts.length; i < l; i++) {
            var part = parts[i];
            // Remove leading and trailing slashes
            // Also remove "." segments
            if (!part || part === ".") continue;
            // Interpret ".." to pop the last segment
            if (part === "..") {
                if (!newParts.length) backsteps ++;
                else newParts.pop();
            }
            // Push new path segments.
            else newParts.push(part);
        }
        // Preserve the initial slash if there was one.
        if (parts[0] === "") newParts.unshift("");
        // Turn back into a single string path.
        return '../'.repeat(backsteps) + newParts.join("/") || (newParts.length ? "/" : ".");
    },
    // A simple function to get the dirname of a path
    // Trailing slashes are ignored. Leading slash is preserved.
    dirname(path) {
        return this.join(path, "..");
    }
};

export const pattern = (pattern, baseUrl = null) => ({
    pattern: new URLPattern(pattern, baseUrl),
    isPattern() {
        return Object.keys(this.pattern.keys || {}).some(compName => this.pattern.keys[compName].length);
    },
    test(...args) { return this.pattern.test(...args) }, 
    exec(...args) {
        let components = this.pattern.exec(...args);
        if (!components) return;
        components.vars = Object.keys(this.pattern.keys).reduce(({ named, unnamed }, compName) => {
            this.pattern.keys[compName].forEach(key => {
                let value = components[compName].groups[key.name];
                if (typeof key.name === 'number') {
                    unnamed.push(value);
                } else {
                    named[key.name] = value;
                }
            });
            return { named, unnamed };
        }, { named: {}, unnamed: [] });
        components.render = str => {
            return str.replace(/\$(\$|[0-9A-Z]+)/gi, (a, b) => {
                return b === '$' ? '$' : (_isNumeric(b) ? components.vars.unnamed[b - 1] : components.vars.named[b]) || '';
            });
        }
        return components;
    }
});