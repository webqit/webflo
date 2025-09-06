import { forwardPort } from './wq-message-port.js';
import { WQStarPort } from './WQStarPort.js';

export class WQRelayPort extends WQStarPort {

    #namespace;
    get namespace() { return this.#namespace; }

    constructor(namespace = null) {
        super();
        this.#namespace = namespace;
    }

    addPort(port, { resolveData = null } = {}) {
        const $resolveData = (data, ...args) => {
            if (resolveData) {
                return resolveData(data, ...args);
            }
            return data;
        };
        // Setup
        const superCleanup = super.addPort(port, { enableBubbling: false });
        const forwardingCleanup = forwardPort.call(port, '*', this, { bidirectional: false, resolveData: $resolveData, namespace1: this.namespace, namespace2: this.namespace });
        const messageType_ping = this.namespace && `${this.namespace}:message` || 'message';
        this.postMessage(
            $resolveData({
                event: 'joins',
            }, port, this),
            { wqEventOptions: { type: messageType_ping }, wqProcessingOptions: { except: port } }
        );
        // Teardown
        const leaves = () => {
            forwardingCleanup();
            this.postMessage(
                $resolveData({
                    event: 'leaves',
                }, port, this),
                { wqEventOptions: { type: messageType_ping }, wqProcessingOptions: { except: port } }
            );
        };
        port.wqLifecycle.close.then(leaves);
        return () => {
            superCleanup(); // Cascade to super
            leaves();
        };
    }
}