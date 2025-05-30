import { MultiportMessagingAPI } from '../webflo-messaging/MultiportMessagingAPI.js';

export class ClientMessagingPort extends MultiportMessagingAPI {

    get runtime() { return this.parentNode.parentNode; }

    #portID;
    get portID() { return this.#portID; }

    #navigatedIn = false;
    navigatedIn() { return this.#navigatedIn; }

    #navigatedAway = false;
    navigatedAway() { return this.#navigatedAway; }

    constructor(parentNode/*ClientMessagingRegistry*/, portID, params = {}) {
        super(parentNode, params);
        this.#portID = portID;
        if (params.url) {
            let url = new URL(params.url), lastNavigationEvent;
            this.addEventListener('navigation', (e) => {
                if (e.data.pathname === url.pathname) {
                    this.#navigatedIn = true;
                    lastNavigationEvent = 'navigatein';
                } else {
                    this.#navigatedAway = true;
                    lastNavigationEvent = 'navigateaway';
                }
                this.dispatchEvent(new Event(lastNavigationEvent));
            });
        }
    }

    createBroadcastChannel(name) {
        return this.parentNode.createBroadcastChannel(name);
    }
}
