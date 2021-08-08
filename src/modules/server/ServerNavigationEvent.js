
/**
 * @imports
 */
import Url from 'url';
import Accepts from 'accepts';
import Formidable from 'formidable';
import NavigationEvent from '../NavigationEvent.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';
import StdResponse from './StdResponse.js';

/**
 * The ServerNavigationEvent class
 */
export default class ServerNavigationEvent extends NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     * @param String protocol 
     */
    constructor(request, protocol = 'http') {
        super(request);
        this.url = Url.parse(protocol + '://' + request.headers.host + request.url);
        this.url.query = wwwFormUnserialize(this.url.search); 
        this.StdResponse = StdResponse;
    }
        
    // Payload
    static parseRequestBody(request) {
        return new Promise(async resolve => {
            var contentType = request.headers['content-type'];
            var payload = {
                contents: null,
                inputs: {},
                files: {},
                type: contentType === 'application/x-www-form-urlencoded' || contentType.startsWith('multipart/') ? 'form-data' 
                    : (contentType === 'application/json' ? 'json'
                        : (contentType === 'text/plain' ? 'plain' 
                            : 'raw')),
            };
            var formidable = new Formidable.IncomingForm({multiples: true, keepExtensions: true});
            formidable.parse(this.request, function(error, inputs, files) {
                if (error) {
                    reject(error);
                    return;
                }
                if (payload.type === 'form-data') {
                    payload.contents = { ...inputs, ...files };
                    Object.keys(inputs).forEach(name => {
                        wwwFormSet(payload.inputs, name, inputs[name]);
                    });
                    Object.keys(files).forEach(name => {
                        wwwFormSet(payload.files, name, files[name]);
                    });
                } else {
                    payload.contents = inputs;
                }
                resolve(payload);
            });
            resolve(payload);
        });
    }

    // Cookies
    get cookies() {
        if (!this.requestParse.cookies) {
            this.requestParse.cookies = wwwFormUnserialize(this.request.headers.cookie, {}, ';');
            this.requestParse.cookiesProxy = new Proxy(this.requestParse.cookies, {
                set(target, key, value) {
                    throw new Error('Not yet implemented: set-cookie proxy.');
                    return true;
                },
                deleteProperty(target, key) {
                    throw new Error('Not yet implemented: set-cookie proxy.');
                    return true;
                }
            });
        }
        return this.requestParse.cookiesProxy;
    }

    // Accept Header
    get accepts() {
        if (!this.requestParse.accepts) {
            this.requestParse.accepts = Accepts(this.request);
        }
        return this.requestParse.accepts;
    }
}