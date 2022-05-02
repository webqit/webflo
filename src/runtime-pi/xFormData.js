
/**
 * @imports
 */
import { _isTypeObject, _isNumeric } from '@webqit/util/js/index.js';
import { _before } from '@webqit/util/str/index.js';
import { wwwFormSet, wwwFormPathSerializeCallback } from './util.js';

 /**
  * The _Headers Mixin
  */
const xFormData = whatwagFormData => class extends whatwagFormData {

    tee(callback = null) {
        const formData1 = new this.constructor, formData2 = new this.constructor;
        for (var [ name, value ] of this.entries()) {
            const formDataType = formDataType(value);
            if ((callback && callback(value, name, formDataType)) || (!callback && !formDataType)) {
                formData1.append(name, value);
            } else {
                formData2.append(name, value);
            }
        }
        return [ formData1, formData2 ];
    }

    json(data = {}, callback = null) {
        if (arguments.length) {
            Object.keys(data).forEach(key => {
                wwwFormPathSerializeCallback(key, data[key], (_wwwFormPath, _value) => {
                    if (!callback || callback(_wwwFormPath, _value, _isTypeObject(_value))) {
                        this.append(_wwwFormPath, _value);
                    }
                }, value => !formDataType(value));
            });
            return;
        }
        var jsonBuild; // We'll dynamically determine if this should be an array or an object
        for (var [ name, value ] of this.entries()) {
            if (!jsonBuild) {
                jsonBuild = _isNumeric(_before(name, '[')) ? [] : {};
            }
            wwwFormSet(jsonBuild, name, value);
        }
        return jsonBuild;
    }

}

export default xFormData;

export const formDataType = (value, list = null) => {
    if (!_isTypeObject(value)) {
        return;
    }
    const toStringTag = value[Symbol.toStringTag];
    return (list || [
        'Uint8Array', 'Uint16Array', 'Uint32Array', 'ArrayBuffer', 'Blob', 'File', 'FormData', 'Stream'
    ]).reduce((_toStringTag, type) => _toStringTag || (toStringTag === type ? type : null), null);
};