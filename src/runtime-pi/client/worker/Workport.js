
export default class Workport {

    constructor() {
        // --------
        // Post messaging
        // --------
        this.messaging = {
            post: (message, client = this.client) => {
                if (!client) throw new Error(`No client for this operation.`);
                client.postMessage(message);
                return this.post;
            },
            listen: (callback, client = this.client) => {
                if (!client) {
                    self.addEventListener('message', evt => {
                        this.client = evt.source;
                        const response = callback(evt);
                        let responsePort = evt.ports[0];
                        if (responsePort) {
                            if (response instanceof Promise) {
                                response.then(data => {
                                    responsePort.postMessage(data);
                                });
                            } else {
                                responsePort.postMessage(response);
                            }
                        }
                    });
                    return this.post;
                }
                client.addEventListener('message', callback);
                return this.post;
            },
            request: (message, client = this.client) => {
                if (!client) throw new Error(`No client for this operation.`);
                return new Promise(res => {
                    let messageChannel = new MessageChannel();
                    client.postMessage(message, [ messageChannel.port2 ]);
                    messageChannel.port1.onmessage = e => res(e.data);
                });
            },
            channel(channelId) {
                if (!this.channels.has(channelId)) { this.channels.set(channelId, new BroadcastChannel(channel)); }
                let channel = this.channels.get(channelId);
                return {
                    broadcast: message => channel.postMessage(message),
                    listen: callback => channel.addEventListener('message', callback),
                };
            },
            channels: new Map,
        };

        // --------
        // Notifications
        // --------
        this.notifications = {
            fire: (title, params = {}) => {
                return new Promise((res, rej) => {
                    if (!(self.Notification && self.Notification.permission === 'granted')) {
                        return rej(self.Notification && self.Notification.permission);
                    }
                    notification.addEventListener('error', rej);
                    let notification = new self.Notification(title, params);
                    notification.addEventListener('click', res);
                    notification.addEventListener('close', res);
                });
            },
            handle: callback => {
                self.addEventListener('notificationclick', callback);
                return this.notifications;
            },
        };

        // --------
        // Push Notifications
        // --------
        this.push = {
            listen: callback => {
                self.addEventListener('push', callback);
                return this.post;
            },
        };
    }

    setCurrentClient(client) {
        this.client = client;
    }

}