
/**
 * @imports
 */
import NavigationEvent from '../NavigationEvent.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';
import Url from './Url.js';

/**
 * The ClientNavigationEvent class
 */
export default class ClientNavigationEvent extends NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     * @param Response response 
     */
    constructor(request, response) {
        super(request, response);
        this.url = Url.parseUrl(request.url);
        this.url.search = wwwFormUnserialize(this.url.search); 
    }
    
    // Payload
    getPayload() {
        if (!this.requestParse.payloadPromise) {
            this.requestParse.payloadPromise = new Promise(async resolve => {
                var contentType = this.request.headers['content-type'];
                    var payload = {
                        inputs: {},
                        files: {},
                        type: contentType === 'application/x-www-form-urlencoded' ? 'form' 
                            : (contentType === 'application/json' ? 'json' 
                                : (contentType.startsWith('multipart/') ? 'multipart' 
                                    : contentType)),
                    };
                var formData = await this.request.clone().getFormData();
                for(var [ name, value ] of formData.entries()) {
                    if (value instanceof File) {
                        wwwFormSet(payload.files, name, value);
                    } else {
                        wwwFormSet(payload.inputs, name, value);
                    }
                }
                resolve(payload);
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
}