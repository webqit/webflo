import { ClientPortMixin } from './ClientPortMixin.js';
import { StarPort, MessageEventPlus } from '@webqit/port-plus';
import { _portPlusMeta } from '../../util.js';

export class ClientRequestPort001 extends ClientPortMixin(StarPort) {

    #portID;
    get portID() { return this.#portID; }

    get broadcast() { return _portPlusMeta(this).get('parentPort'); }

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
            const event = new MessageEventPlus(null, { type: lastNavigationEvent, target: this });
            this.dispatchEvent(event);
            if (event.defaultPrevented) {
                e.preventDefault();
            }
        });
    }

    enterChannel(channelID, { resolveData = null } = {}) {
        const webfloTenant = _portPlusMeta(this).get('parentPort');
        const webfloTenancy = webfloTenant && _portPlusMeta(webfloTenant).get('parentPort');

        if (!webfloTenancy) {
            throw new Error('Instance is not connected to the multi-tenant system.');
        }

        const channel = webfloTenancy.getChannel(channelID, true);
        const leave = channel.addPort(webfloTenant, { resolveData });
        
        return { channel, leave };
    }
}