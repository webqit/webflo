import { ClientPortMixin } from './ClientPortMixin.js';
import { BroadcastChannelPlus } from '@webqit/port-plus';

export class ClientRequestPort010 extends ClientPortMixin(BroadcastChannelPlus) {}