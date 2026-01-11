import { ClientPortMixin } from './ClientPortMixin.js';
import { MessageChannelPlus } from '@webqit/port-plus';

export class ClientRequestPort100 extends MessageChannelPlus {

    constructor(options = {}) {
        super(options);

        const superInstance = new (ClientPortMixin(class { }));
        Object.defineProperty(this.port1, 'query', {
            value: function (...args) {
                return superInstance.query.apply(this, args);
            }
        });

    }
}