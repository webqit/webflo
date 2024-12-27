export class Workport {

    constructor(client) {
        this.client = client;
        // --------
        // Post messaging
        // --------
        this.messaging = {
            post: (message, client = this.client) => {
                if (!client) throw new Error(`No client for this operation.`);
                client.postMessage(message);
                return this;
            },
            listen: (callback, client = this.client) => {
                (client || self).addEventListener('message', evt => {
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
                return this;
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
            handle: callback => {
                self.addEventListener('notificationclick', e => e.waitUntil(callback(e)));
                return this;
            },
            fire: (title, params = {}) => {
                return self.registration.showNotification(title, params);
            },
        };

        // --------
        // Push Notifications
        // --------
        this.push = {
            listen: callback => {
                self.addEventListener('push', e => e.waitUntil(callback(e)));
                return this;
            },
        };
    }

}