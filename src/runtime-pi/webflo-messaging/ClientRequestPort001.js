import { ClientPortMixin } from './ClientPortMixin.js';
import { StarPort } from '@webqit/port-plus';
import { _meta } from '../../util.js';

export class ClientRequestPort001 extends ClientPortMixin(StarPort) {

    #portID;
    get portID() { return this.#portID; }

    #url;
    get url() { return this.#url; }

    #navigatedIn = false;
    navigatedIn() { return this.#navigatedIn; }

    #navigatedAway = false;
    navigatedAway() { return this.#navigatedAway; }

    constructor(portID, url, options = {}) {
        super(options);
        this.#portID = portID;
        this.#url = url;
        const $url = new URL(url);
        let lastNavigationEvent;
        this.addEventListener('navigate', (e) => {
            if (e.data.pathname === $url.pathname) {
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

    enterChannel(channelID, { resolveData = null } = {}) {
        const webfloTenant = _meta(this).get('parentNode');
        const clients = webfloTenant && _meta(webfloTenant).get('parentNode');

        if (!clients) {
            throw new Error('Instance seem not connected to the messaging system.');
        }

        const channel = clients.getChannel(channelID, true);
        const leave = channel.addPort(webfloTenant, { resolveData });
        
        return { channel, leave };
    }
}