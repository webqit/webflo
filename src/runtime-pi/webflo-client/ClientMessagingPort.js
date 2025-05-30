import { MessagingOverChannel } from '../webflo-messaging/MessagingOverChannel.js';

export class ClientMessagingPort extends MessagingOverChannel {
    get runtime() { return this.parentNode; }
}
