import { MessagingOverChannel } from './MessagingOverChannel.js';

export class MessagingOverBroadcast extends MessagingOverChannel {

    constructor(parentNode, instanceOrChannelName, params = {}) {
        const port = typeof instanceOrChannelName === 'string' ? new BroadcastChannel(instanceOrChannelName) : instanceOrChannelName;
        super(parentNode, port, params);
    }
}