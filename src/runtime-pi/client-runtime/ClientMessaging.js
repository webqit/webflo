import { MessagingOverChannel } from '../messaging-apis/MessagingOverChannel.js';

export class ClientMessaging extends MessagingOverChannel {
    get runtime() { return this.parentNode; }
}
