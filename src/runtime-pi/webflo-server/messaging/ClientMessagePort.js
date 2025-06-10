import { MultiportMessagingAPI } from '../../webflo-messaging/MultiportMessagingAPI.js';
import { $parentNode } from '../../../util.js';

export class ClientMessagePort extends MultiportMessagingAPI {

    #portID;
    get portID() { return this.#portID; }

    #navigatedIn = false;
    navigatedIn() { return this.#navigatedIn; }

    #navigatedAway = false;
    navigatedAway() { return this.#navigatedAway; }

    constructor(parentNode, portID, params = {}) {
        super(parentNode, params);
        this.#portID = portID;
        if (params.url) {
            const url = new URL(params.url);
            let lastNavigationEvent;
            this.addEventListener('navigate', (e) => {
                if (e.data.pathname === url.pathname) {
                    this.#navigatedIn = true;
                    lastNavigationEvent = 'navigatein';
                } else {
                    this.#navigatedAway = true;
                    lastNavigationEvent = 'navigateaway';
                }
                const event = new Event(lastNavigationEvent);
                this.dispatchEvent(event);
                if (event.defaultPrevented) {
                    e.preventDefault();
                }
            });
        }
    }

    enterChannel(channelID, ...args) {
        const tenant = this[$parentNode];
        const tenants = tenant[$parentNode];
        const channel = tenants.getChannel(channelID, true);
        const cleanup = channel.addTenant(tenant, ...args);
        return { channel, cleanup };
    }
}
