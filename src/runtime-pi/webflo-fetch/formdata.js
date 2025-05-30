
import { _isNumeric } from '@webqit/util/js/index.js';
import { _before } from '@webqit/util/str/index.js';
import { DeepURLSearchParams } from '../webflo-url/util.js';
import { dataType } from './util.js';

export function createFormDataFromJson(data = {}, jsonfy = true, getIsJsonfiable = false) {
    const formData = new FormData;
    let isJsonfiable = true;
    DeepURLSearchParams.reduceValue(data, '', (value, contextPath, suggestedKeys = undefined) => {
        if (suggestedKeys) {
            const isJson = dataType(value) === 'json';
            isJsonfiable = isJsonfiable && isJson;
            return isJson && suggestedKeys;
        }
        if (jsonfy && [true, false, null].includes(value)) {
            value = new Blob([value], { type: 'application/json' });
        }
        formData.append(contextPath, value);
    });
    if (getIsJsonfiable) return [formData, isJsonfiable];
    return formData;
}

export async function renderFormDataToJson(formData, jsonfy = true, getIsJsonfiable = false) {
    let isJsonfiable = true;
    let json;
    for (let [name, value] of formData.entries()) {
        if (!json) { json = _isNumeric(_before(name, '[')) ? [] : {}; }
        let type = dataType(value);
        if (jsonfy && ['Blob', 'File'].includes(type) && value.type === 'application/json') {
            let _value = await value.text();
            value = JSON.parse(_value);
            type = 'json';
        }
        isJsonfiable = isJsonfiable && type === 'json';
        DeepURLSearchParams.set(json, name, value);
    }
    if (getIsJsonfiable) return [json, isJsonfiable];
    return json;
}

Object.defineProperties(FormData, {
    json: { value: createFormDataFromJson }
});

Object.defineProperties(FormData.prototype, {
    json: {
        value: async function (data = {}) {
            const result = await renderFormDataToJson(this, ...arguments);
            return result;
        }
    }
});