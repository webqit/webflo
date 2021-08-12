
/**
 * @imports
 */
import Http from 'http';
import Accepts from 'accepts';
import Formidable from 'formidable';
import { _isTypeObject } from '@webqit/util/js/index.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';

/**
 * The Request class
 */
export default class StdIncomingMessage extends Http.IncomingMessage {

    // Accept Header
    get accepts() {
        if (!this._accepts) {
            this._accepts = Accepts(this);
        }
        return this._accepts;
    }
    
    get cookies() {
        if (!this._cookies) {
            this._cookies = wwwFormUnserialize(this.headers.cookie, {}, ';');
        }
        return this._cookies;
    }

        
    // Payload
    parse() {
        return new Promise(async resolve => {
            var request = this;
            var contentType = request.headers['content-type'];
            var submits = {
                payload: null,
                inputs: {},
                files: {},
                type: contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') ? 'form-data' 
                    : (contentType === 'application/json' ? 'json'
                        : (contentType === 'text/plain' ? 'plain' 
                            : 'other')),
            };
            var formidable = new Formidable.IncomingForm({multiples: true, keepExtensions: true});
            formidable.parse(request, function(error, inputs, files) {
                if (error) {
                    reject(error);
                    return;
                }
                if (submits.type === 'form-data') {
                    submits.payload = { ...inputs, ...files };
                    Object.keys(inputs).forEach(name => {
                        wwwFormSet(submits.inputs, name, inputs[name]);
                    });
                    Object.keys(files).forEach(name => {
                        wwwFormSet(submits.files, name, files[name]);
                    });
                } else {
                    submits.payload = inputs;
                    if (submits.type === 'json' && _isTypeObject(submits.payload)) {
                        submits.inputs = inputs;
                    }
                }
                resolve(submits);
            });
        });
    }
}
