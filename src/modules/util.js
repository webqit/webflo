
/**
 * @imports
 */
import _isArray from '@webqit/util/js/isArray.js';
import _isNumeric from '@webqit/util/js/isNumeric.js';
import _isString from '@webqit/util/js/isString.js';
import _isObject from '@webqit/util/js/isObject.js';
import _beforeLast from '@webqit/util/str/beforeLast.js';
import _afterLast from '@webqit/util/str/afterLast.js';
import _arrFrom from '@webqit/util/arr/from.js';
  
/**
 * ---------------
 * @wwwFormPathUnserializeCallback
 * ---------------
 */

export function wwwFormPathUnserializeCallback(form, wwwFormPath, callback, touch = false) {
    if (_isString(wwwFormPath) && wwwFormPath.endsWith(']')) {
        var index = _beforeLast(_afterLast(wwwFormPath, '['), ']') || 0;
        if (_isNumeric(index)) {
            index = parseInt(index);
        }
        wwwFormPath = _beforeLast(wwwFormPath, '[') || 0;
        if (_isNumeric(wwwFormPath)) {
            wwwFormPath = parseInt(wwwFormPath);
        }
        return wwwFormPathUnserializeCallback(form, wwwFormPath, (_form, _wwwFormPath) => {
            if (!_form[_wwwFormPath]) {
                if (!touch) {
                    return callback();
                }
                _form[_wwwFormPath] = _isNumeric(index) ? [] : {};
            }
            return callback(_form[_wwwFormPath], index);
        }, touch);
    } else {
        return callback(form, wwwFormPath);
    }
}

export function wwwFormSet(form, wwwFormPath, value, append = true) {
    wwwFormPathUnserializeCallback(form, wwwFormPath, (_form, _key) => {
        if (_isNumeric(_key)) {
            _key = _key || _isArray(_form) 
                ? _form.length 
                : Object.keys(_form).filter(_isNumeric).length;
            _arrFrom(value, false).forEach((_value, i) => {
                _form[_key + i] = _value;
            });
        } else {
            _form[_key] = append && (_key in _form) ? _arrFrom(_form[_key], false).concat(value) : value;
        }
    }, true);
}

export function wwwFormGet(form, wwwFormPath) {
    return wwwFormPathUnserializeCallback(form, wwwFormPath, function(_form, _key) {
        if (arguments.length) {
            return _form[_key]
        }
    }, false);
}

export function wwwFormUnserialize(str, target = {}, delim = '&') {
    str = str || '';
    (str.startsWith('?') ? str.substr(1) : str)
        .split(delim).filter(q => q).map(q => q.split('=').map(q => q.trim()))
        .forEach(q => wwwFormSet(target, q[0], decodeURIComponent(q[1])));
    return target;
}

/**
 * ---------------
 * @wwwFormPathSerialize
 * ---------------
 */

export function wwwFormPathSerializeCallback(wwwFormPath, value, callback, shouldSerialize = null) {
    if ((_isObject(value) || _isArray(value)) && (!shouldSerialize || shouldSerialize(value, wwwFormPath))) {
        var isArr = _isArray(value);
        Object.keys(value).forEach(key => {
            wwwFormPathSerializeCallback(`${wwwFormPath}[${!isArr ? key : ''}]`, value[key], callback);
        });
    } else {
        callback(wwwFormPath, !value && value !== 0 ? '' : value);
    }
}

export function wwwFormSerialize(form, delim = '&', shouldSerialize = null) {
    var q = [];
    Object.keys(form).forEach(key => {
        wwwFormPathSerializeCallback(key, form[key], (_wwwFormPath, _value) => {
            q.push(`${_wwwFormPath}=${encodeURIComponent(_value)}`);
        }, shouldSerialize);
    });
    return q.join(delim);
}

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
