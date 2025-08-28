import { toWQPort} from './wq-message-port.js';

export class WQBroadcastChannel extends BroadcastChannel {
    constructor(channelName) {
        super(channelName);
        toWQPort(this);
    }
}

globalThis.WQBroadcastChannel = WQBroadcastChannel;
