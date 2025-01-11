import { MessagingOverBroadcast } from '../../MessagingOverBroadcast.js';

export class ClientMessaging extends MessagingOverBroadcast {
    get runtime() { return this.parentNode; }
}