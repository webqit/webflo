
/**
 * @imports
 */
import XURL from '../XURL.js';
import NavigationEvent from '../NavigationEvent.js';

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
        this._url = new XURL(protocol + '://' + request.headers.host + request.url);
    }
}