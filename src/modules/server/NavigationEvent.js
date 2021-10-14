
/**
 * @imports
 */
import { URL } from 'url';
import Accepts from 'accepts';
import Formidable from 'formidable';
import { Readable } from "stream";
import { FormData, File, Blob } from 'formdata-node';
import { FormDataEncoder } from 'form-data-encoder';
import { Request, Response, Headers } from 'node-fetch';
import _NavigationEvent from '../_NavigationEvent.js';
import { _isObject } from '@webqit/util/js/index.js';

/**
 * Patch MessageStream with formData()
 */
const _formDataPatch = MessageStream => class extends MessageStream {

    // formData() polyfill
    formData() {
        return new Promise((resolve, reject) => {
            var formidable = new Formidable.IncomingForm({multiples: true, keepExtensions: true});
            formidable.parse(this.__request || this.body, function(error, fields, files) {
                if (error) {
                    reject(error);
                    return;
                }
                const formData = new FormData;
                Object.keys(fields).forEach(name => {
                    if (Array.isArray(fields[name])) {
                        const values = Array.isArray(fields[name][0]) 
                            ? fields[name][0]/* bugly a nested array when there are actually more than entry */ 
                            : fields[name];
                        values.forEach(value => {
                            formData.append(!name.endsWith(']') ? name + '[]' : name, value);
                        });
                    } else {
                        formData.append(name, fields[name]);
                    }
                 });
                Object.keys(files).forEach(name => {
                    const fileCompat = file => {
                        if (!file.name) return '';
                        // IMPORTANT
                        // Path up the "formidable" file in a way that "formdata-node"
                        // to can translate it into its own file instance
                        file[Symbol.toStringTag] = 'File';
                        file.stream = () => file._writeStream;
                        // Done pathcing
                        return file;
                    }
                    if (Array.isArray(files[name])) {
                        files[name].forEach(value => {
                            formData.append(name, fileCompat(value));
                        });
                    } else {
                        formData.append(name, fileCompat(files[name]));
                    }
                });
                resolve(formData);
            });
        });
    }

};

/**
 * The NavigationEvent class
 */
export default _NavigationEvent({
    URL,
    Request: class extends _formDataPatch(Request) {

        // Accept Header
        get accepts() {
            if (!this._accepts) {
                this._accepts = Accepts({ headers: this.headers.json() });
            }
            return this._accepts;
        }

    },
    Response: _formDataPatch(Response),
    Headers,
    FormData,
    File,
    Blob,
    ReadableStream: Readable,
    FormDataEncoder
});
