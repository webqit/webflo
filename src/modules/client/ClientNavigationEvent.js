
/**
 * @imports
 */
import NavigationEvent from '../NavigationEvent.js';
import { wwwFormUnserialize, wwwFormSet } from '../util.js';
import StdResponse from './StdResponse.js';
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
    constructor(request) {
        super(request);
        this.url = Url.parseUrl(request.url);
        this.url.query = wwwFormUnserialize(this.url.search); 
        this.StdResponse = StdResponse;
    }
        
    // Payload
    static parseRequestBody(request) {
        return new Promise(async resolve => {
            request = request.clone();
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
            if (payload.type === 'form-data') {
                payload.contents = await request.formData();
                for(var [ name, value ] of payload.contents.entries()) {
                    if (value instanceof File) {
                        wwwFormSet(payload.files, name, value);
                    } else {
                        wwwFormSet(payload.inputs, name, value);
                    }
                }
            } else {
                payload.contents = await (payload.type === 'json' 
                    ? request.json() : (
                        payload.type === 'plain' ? request.text() : request.arrayBuffer()
                    )
                )
            }
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
}