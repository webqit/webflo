import { _isObject } from '@webqit/util/js/index.js';
import { toWQPort, portIsMessaging, forwardPort, preProcessPostMessage, portHooksCleanup } from './wq-message-port.js';
import { WQMessageEvent } from './WQMessageEvent.js';
import { WQMessagePort } from './WQMessagePort.js';
import { _wq } from '../../util.js';

export class WQSockPort extends WQMessagePort {

    static WebSocket = typeof WebSocket !== 'undefined' ? WebSocket : null;

    #socket;
    #cleanups = [];

    constructor(instanceOrConnectionID) {
        super();
        this.#socket = typeof instanceOrConnectionID === 'string' ? new this.constructor.WebSocket(`/${instanceOrConnectionID}`) : instanceOrConnectionID;
        const meta = _wq(this, 'meta');
        Object.defineProperty(this, 'wqLifecycle', {
            value: {
                open: new Promise((resolve) => {
                    if (meta.get('open')) return resolve();
                    meta.set('onlineCallback', resolve);
                }),
                close: new Promise((resolve) => {
                    if (meta.get('close')) return resolve();
                    meta.set('offlineCallback', resolve);
                }),
                messaging: new Promise((resolve) => {
                    if (meta.get('messaging')) return resolve();
                    meta.set('messagingCallback', resolve);
                }),
            },
            configurable: true
        });
        const fireOpen = () => {
            this.dispatchEvent(new Event('open'));
            meta.get('onlineCallback')();
        };
        const fireClose = () => {
            this.dispatchEvent(new Event('close'));
            meta.get('offlineCallback')();
        };
        if (this.#socket.readyState === this.#socket.constructor.OPEN) {
            fireOpen();
        }
        const fireError = () => {
            this.dispatchEvent(new Event('error'));
        };
        // --------
        const handleMessage = async (event) => {
            let json;
            try {
                if (!(json = JSON.parse(event.data))
                    || !json['.wq']
                    || !('data' in json)
                    || !['wqEventOptions', 'wqProcessingOptions'].every((k) => _isObject(json[k]))) {
                    return;
                }
            } catch (e) {
                // throw a better error
            }
            // Build event details...
            const { data, wqEventOptions, wqProcessingOptions } = json;
            const eventInit = { data, wqEventOptions, ports: [] };
            if (wqProcessingOptions.dataOriginallyUndefined) {
                eventInit.data = undefined;
            }
            for (let i = 0; i < (wqProcessingOptions.numPorts || 0); i++) {
                const channel = new MessageChannel;
                channel.port1.start();
                toWQPort(channel.port1);
                this.#cleanups.push(forwardPort.call(this, '*', channel.port1, { bidirectional: true, namespace1: `${wqEventOptions.eventID}:${i}` }));
                eventInit.ports.push(channel.port2);
            }
            this.dispatchEvent(new WQMessageEvent(this, eventInit));
        };
        const handleClose = (e) => {
            this.#socket.removeEventListener('message', handleMessage);
            this.#socket.removeEventListener('open', fireOpen);
            this.#socket.removeEventListener('error', fireError);
            this.#socket.removeEventListener('close', handleClose);
            for (const c of this.#cleanups) {
                c();
            }
            portHooksCleanup.call(this);
            fireClose();
        };
        this.#socket.addEventListener('message', handleMessage);
        this.#socket.addEventListener('open', fireOpen);
        this.#socket.addEventListener('error', fireError);
        this.#socket.addEventListener('close', handleClose);
    }

    postMessage(data, transferOrOptions = []) {
        const { transfer = [], wqEventOptions = {}, wqProcessingOptions: _, ...portOptions } = preProcessPostMessage.call(this, data, transferOrOptions);
        const messagePorts = transfer.filter((t) => t instanceof MessagePort);
        portIsMessaging.call(this);
        this.#socket.send(JSON.stringify({
            data: data === undefined ? null : data,
            wqEventOptions,
            wqProcessingOptions: { numPorts: messagePorts.length, dataOriginallyUndefined: data === undefined },
            ['.wq']: true,
        }), portOptions);
        for (let i = 0; i < messagePorts.length; i++) {
            toWQPort(messagePorts[i]);
            this.#cleanups.push(forwardPort.call(this, '*', messagePorts[i], { bidirectional: true, namespace1: `${wqEventOptions.eventID}:${i}` }));
        }
    }

    close() {
        return this.#socket.close();
    }
}