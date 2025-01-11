import { MessagingOverChannel } from '../MessagingOverChannel.js';

export class ClientMessaging extends MessagingOverChannel {
    get runtime() { return this.parentNode; }
}
