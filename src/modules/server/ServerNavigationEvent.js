
/**
 * @imports
 */
import Url from 'url';
import Accepts from 'accepts';
import Formidable from 'formidable';
import NavigationEvent from '../NavigationEvent.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';

/**
 * The ServerNavigationEvent class
 */
export default class ServerNavigationEvent extends NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     * @param Response response 
     * @param String protocol 
     */
    constructor(request, response, protocol = 'http') {
        super(request, response);
        this.url = Url.parse(protocol + '://' + request.headers.host + request.url);
        this.url.query = wwwFormUnserialize(this.url.search); 
        this.requestParse = {
            payloadPromise: null,
            cookies: null,
            accepts: null,
        };
    }
    
    // Payload
    getPayload() {
        if (!this.requestParse.payloadPromise) {
            this.requestParse.payloadPromise = new Promise((resolve, reject) => {
                var formidable = new Formidable.IncomingForm({multiples: true});
                formidable.parse(this.request, function(error, inputs, files) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    var contentType = this.request.headers['content-type'];
                    var payload = {
                        inputs: {},
                        files: {},
                        type: contentType === 'application/x-www-form-urlencoded' ? 'form' 
                            : (contentType === 'application/json' ? 'json' 
                                : (contentType.startsWith('multipart/') ? 'multipart' 
                                    : contentType)),
                    };
                    Object.keys(inputs).forEach(name => {
                        wwwFormSet(payload.inputs, name, inputs[name]);
                    });
                    Object.keys(files).forEach(name => {
                        wwwFormSet(payload.files, name, files[name]);
                    });
                    resolve(payload);
                });
            });
        }
        return this.requestParse.payloadPromise;
    }

    // Cookies
    get cookies() {
        if (!this.requestParse.cookies) {
            this.requestParse.cookies = wwwFormUnserialize(this.request.headers.cookie, {}, ';');
            this.requestParse.cookiesProxy = new Proxy(this.requestParse.cookies, {
                set(target, key, value) {
                    return true;
                },
                deleteProperty(target, key) {
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