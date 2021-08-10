
/**
 * @imports
 */
import XURL from '../XURL.js';
import NavigationEvent from '../NavigationEvent.js';

/**
 * The ClientNavigationEvent class
 */
export default class ClientNavigationEvent extends NavigationEvent {

    /**
     * Initializes a new NavigationEvent instance.
     * 
     * @param Request request 
     */
    constructor(request) {
        super(request);
        this._url = new XURL(request.url);
    }
}