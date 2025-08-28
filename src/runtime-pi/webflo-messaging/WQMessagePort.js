import { internalAddEventListener, postRequest, handleRequests, forwardPort, forwardEvent } from './wq-message-port.js';
import { _wq } from '../../util.js';

export const WQMessagePortInstanceTag = Symbol('WQMessagePortInstanceTag');

export class WQMessagePort extends EventTarget {

    [WQMessagePortInstanceTag] = true;

    static [Symbol.hasInstance](instance) {
        return !!instance?.[WQMessagePortInstanceTag];
    }

    addEventListener(...args) {
        internalAddEventListener.call(this, args);
        return super.addEventListener(...args);
    }

    dispatchEvent(event) {
        const returnValue = super.dispatchEvent(event);
        forwardEvent.call(this, event);
        return returnValue;
    }

    postRequest(data, callback, options = {}) {
        return postRequest.call(this, data, callback, options);
    }
    
    handleRequests(type, listener, options = {}) {
        return handleRequests.call(this, type, listener, options);
    }

    wqForwardPort(eventTypes, eventTarget, { resolveData = null, bidirectional = false, namespace1 = null, namespace2 = null } = {}) {
        return forwardPort.call(this, eventTypes, eventTarget, { resolveData, bidirectional, namespace1, namespace2 });
    }
}

globalThis.WQMessagePort = WQMessagePort;
