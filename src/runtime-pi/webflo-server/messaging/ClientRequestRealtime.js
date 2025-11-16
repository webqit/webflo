import { WQStarPort } from '../../webflo-messaging/WQStarPort.js';
import { _wq } from '../../../util.js';

export class ClientRequestRealtime extends WQStarPort {

    #portID;
    get portID() { return this.#portID; }

    #url;
    get url() { return this.#url; }

    #navigatedIn = false;
    navigatedIn() { return this.#navigatedIn; }

    #navigatedAway = false;
    navigatedAway() { return this.#navigatedAway; }

    constructor(portID, url) {
        super();
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
        const client = _wq(this, 'meta').get('parentNode');
        const clients = client && _wq(client, 'meta').get('parentNode');
        if (!clients) {
            throw new Error('Instance seem not connected to the messaging system.');
        }
        const channel = clients.getChannel(channelID, true);
        const leave = channel.addPort(client, { resolveData });
        return { channel, leave };
    }
}
