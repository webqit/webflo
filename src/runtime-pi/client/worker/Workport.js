import { AbstractWorkport } from '../../AbstractWorkport.js';

export class Workport extends AbstractWorkport {

    showNotification(title, params = {}) {
        return self.registration.showNotification(title, params);
    }

    handleNotificationClick(callback) {
        const handler = (e) => e.waitUntil(callback(e));
        self.addEventListener('notificationclick', handler);
        return () => self.removeEventListener('notificationclick', handler);
    }
    
    handlePush(callback) {
        const handler = (e) => e.waitUntil(callback(e));
        self.addEventListener('push', handler);
        return () => self.removeEventListener('notificationclick', handler);
    }
}