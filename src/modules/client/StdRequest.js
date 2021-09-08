
/**
 * @imports
 */
import { _isTypeObject } from '@webqit/util/js/index.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';

/**
 * The Request class
 */
export default class StdRequest extends Request {
    
    constructor(input, init) {
        var src;
        if (input instanceof Request) {
            src = input.clone();
        }
        super(...arguments);
        this.src = src;
    }

    get destination() {
        return this.src ? this.src.destination : '';
    }

    clone() {
        return new this.constructor(this.src || super.clone());
    }

    get cookies() {
        if (!this._cookies) {
            this._cookies = wwwFormUnserialize(this.headers.cookie, {}, ';');
        }
        return this._cookies;
    }
            
    // Payload
    parse(force = false) {
        if (!this._submits || force) {
            this._submits = new Promise(async resolve => {
                var request = this.clone();
                var contentType = request.headers['content-type'] || '';
                var submits = {
                    payload: null,
                    inputs: {},
                    files: {},
                    type: contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') || (!contentType && !['get'].includes(request.method.toLowerCase())) ? 'form-data' 
                        : (contentType === 'application/json' ? 'json'
                            : (contentType === 'text/plain' ? 'plain' 
                                : 'other')),
                };
                if (submits.type === 'form-data') {
                    try {
                        submits.payload = await request.formData();
                        for(var [ name, value ] of submits.payload.entries()) {
                            if (value instanceof File) {
                                wwwFormSet(submits.files, name, value);
                            } else {
                                wwwFormSet(submits.inputs, name, value);
                            }
                        }
                    } catch(e) { }
                } else {
                    submits.payload = await (submits.type === 'json' 
                        ? request.json() : (
                            submits.type === 'plain' ? request.text() : request.arrayBuffer()
                        )
                    )
                    if (submits.type === 'json' && _isTypeObject(submits.payload)) {
                        submits.inputs = inputs;
                    }
                }
                resolve(submits);
            });
        }
        return this._submits;
    }
}
