import { MessagingOverBroadcast } from '../webflo-messaging/MessagingOverBroadcast.js';

export class ClientMessagingPort extends MessagingOverBroadcast {
    get runtime() { return this.parentNode; }
}