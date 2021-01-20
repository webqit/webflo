
/**
 * 
 * @imports
 */

 /**
  * ------------------
  * Push Notifications client class
  * ------------------
  */
export default class Push {

    /**
     * Push Notifications client class
     * 
     * @param object registration
     * @param object params
     * 
     * @return void
     */
    constructor(registration, params) {
        this.registration = registration;
        this.params = params;
    }

    /**
     * Gets the user's subscription
     * 
     * @return void
     */
    async getSubscription() {
        return await this.registration.pushManager.getSubscription();
    }

    /**
     * Subscribes to Push Notifications
     * 
     * @return object
     */
    async subscribe() {
        var subscription = await this.getSubscription();
        if (!subscription) {
            subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(this.params.public_key),
            }).then(subscription => {
                console.log('Subscribed to', subscription.endpoint);
                return subscription;
            });
            return await fetch(this.params.registration_url, {
                method: 'post',
                headers: {'Content-type': 'application/json', Accept: 'application/json'},
                body: JSON.stringify({subscription,}),
            }).then(response => response.json()).then(response => {
                console.log('Subscribed with Notifications server', response);
                return response;
            });
        }
    }

    /**
     * Unsubscribes from Push Notifications
     * 
     * @return object
     */
    async unsubscribe() {
        var subscription = await this.getSubscription();
        if (subscription) {
            subscription.unsubscribe().then(subscription => {
                console.log('Unsubscribed', subscription.endpoint);
                return subscription;
            });
            return await fetch(this.params.deregistration_url, {
                method: 'post',
                headers: {'Content-type': 'application/json', Accept: 'application/json'},
                body: JSON.stringify({subscription,}),
            }).then(response => response.json()).then(response => {
                console.log('Unsubscribed with Notifications server', response);
                return response;
            });
        }
    }
};