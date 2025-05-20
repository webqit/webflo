import { MessagingOverBroadcast } from '../../messaging-apis/MessagingOverBroadcast.js';

export class ClientMessaging extends MessagingOverBroadcast {
    get runtime() { return this.parentNode; }
}