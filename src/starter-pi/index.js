
/**
 * imports
 */
import webpush from 'web-push';

/**
 * @description
 */
export const desc = {
    generate: 'Generate a set of VAPID keys for push notifications.',
};

/**
 * Reads SSL from file.
 * 
 * @return object
 */
export async function init() {
    const cx = this || {};
    const vapidKeys = webpush.generateVAPIDKeys();
    cx.logger.log(vapidKeys);
}