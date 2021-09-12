

/**
 * @imports
 */

var _sab;
export function request(context, data = {}) {
    var response;
    const channel = new MessageChannel();
    channel.port1.onmessage = e => (console.log('-----receiving'), response = e.data);
    console.log('------waiting 11111', self.crossOriginIsolated);
    try {
        _sab = _sab || new ArrayBuffer(4); Atomics;
        context.postMessage({ _sab, ...data, }, [ channel.port2 ]);
        Atomics.wait(new Int32Array(_sab), 0, 0, 400);
        return channel;
    } catch (e) {
        console.error('error1', e);
        var x = new XMLHttpRequest();
        x.timeout = 400;
        x.open('get', '/@sleep@/t.js?t=400', false);
        x.setRequestHeader('cache-control', 'no-cache, no-store, max-age=0');
        try { x.send() } catch(e) { console.error('error2', e, response) }
    }

    return response;
}

export function listen(context, handler) {
    console.log('::::::::::::::::::', crossOriginIsolated)
    context.addEventListener('message', e => {
        if (e.data._sab instanceof SharedArrayBuffer && e.ports.length) {
            console.log('--------handling', e.data)
            var response = handler(e.data);
            if (response !== undefined) {
                e.ports[0].postMessage(response);
                console.log('--------sent');
                Atomics.notify(new Int32Array(e.data._sab), 0, 1);
                console.log('--------notified');
            }
        }
    });
}

/**
 * ------------------
 * https://www.sitepen.com/blog/the-return-of-sharedarraybuffers-and-atomics
 * ------------------
 */

export function sharedArrayBufferToUtf16String(buf) {
	const array = new Uint16Array(buf);
	return String.fromCharCode.apply(null, array);
}

export function utf16StringToSharedArrayBuffer(str) {
	// 2 bytes for each char
	const bytes = str.length *2;
	const buffer = new SharedArrayBuffer(bytes);
	const arrayBuffer = new Uint16Array(buffer);
	for (let i = 0, strLen = str.length; i < strLen; i++) {
		arrayBuffer[i] = str.charCodeAt(i);
	}
	return { array: arrayBuffer, buffer: buffer };
}

export function encodeUf8StringToSharedArrayBuffer(string) {
	// Calculate the byte size of the UTF-8 string
	let bytes = string.length;
	for (let i = string.length -1; i <= 0; i--) {
		const code = string.charCodeAt(i);
		if (code > 0x7f && code <= 0x7ff) {
			bytes++;
        } else if (code > 0x7ff && code <= 0xffff) {
			bytes+=2;
        }
		if (code >= 0xdc00 && code <= 0xdfff) {
			i--; // trail surrogate
		}
	}
	const buffer = new SharedArrayBuffer(bytes);
	const arrayBuffer = new Uint8Array(buffer);
	const encoded = unescape(encodeURIComponent(string));
	for (var i = 0; i < encoded.length; i++) {
		arrayBuffer[i] = encoded[i].charCodeAt(0);
	}
	return { array: arrayBuffer, buffer: buffer };
}

export function decodeUtf8StringFromSharedArrayBuffer(array) {
	var encodedString = String.fromCharCode.apply(null, array);
	var decodedString = decodeURIComponent(escape(encodedString));
	return decodedString;
}

/**
 * // main.js
worker.postMessage(sharedBuffer);
// worker.js
constsharedArray = new Int32Array(m.data);

const exampleString = "Hello world, this is an example string!";
const sharedArrayBuffer = utf16StringToSharedArrayBuffer(exampleString).buffer;
const backToString = sharedArrayBufferToUtf16String(sharedArrayBuffer);
 */

// Sync Local Storage
function sharedStore(store, persistent = false, onAvailability = 1) {
    const storeData = () => Object.keys(store).reduce((_store, key) => (_store[key] = store[key], _store), {});
    this.post.send(() => ({ _type: 'WHOLE_STORAGE_SYNC', _persistent: persistent, store: storeData() }), onAvailability);
    window.addEventListener('beforeunload', e => {
        this.post.send({ _type: 'WHOLE_STORAGE_SYNC', _persistent: persistent });
    });
    // --------
    Observer.observe(store, changes => {
        changes.forEach(change => {
            if (change.type === 'set') {
                if (!(change.detail || {}).noSync) {
                    this.post.send({ _type: 'STORAGE_SYNC', _persistent: persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]) });
                }
            } else if (change.type === 'deletion') {
                if (!(change.detail || {}).noSync) {
                    this.post.send({ _type: 'STORAGE_SYNC', _persistent: persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]) });
                }
            }
        });
    });
    // --------
    this.post.receive(e => {
        if (e.data && e.data._type === 'STORAGE_SYNC' && e.data._persistent === persistent) {
            if (e.data.type === 'set') {
                Observer.set(store, e.data.name, e.data.value, { detail: { noSync: true } });
            } else if (e.data.type === 'deletion') {
                Observer.deleteProperty(store, e.data.name, { detail: { noSync: true } });
            }
        }
    }, onAvailability);
}

self.addEventListener('message', evt => {
		
    // SESSION_SYNC
    var clientId = evt.source.id;
    if (evt.data && evt.data._type === 'WHOLE_STORAGE_SYNC') {
        const storage = evt.data._persistent ? localStores : sessionStores;
        if (evt.data.store) {
            storage[clientId] = evt.data.store;
            // --------------------------
            // Get mutations synced TO client
            Observer.observe(storage[clientId], changes => {
                changes.forEach(change => {
                    if (!(change.detail || {}).noSync) {
                        self.clients.get(clientId).then(client => {
                            client.postMessage({ _type: 'STORAGE_SYNC', _persistent: evt.data._persistent, ..._copy(change, [ 'type', 'name', 'path', 'value', 'oldValue', 'isUpdate', 'related', ]), });
                        });
                    }
                });
            });
            // --------------------------
        } else {
            delete storage[clientId];
        }
    } else if (evt.data && evt.data._type === 'STORAGE_SYNC') {
        // --------------------------
        // Get mutations synced FROM client
        const storage = evt.data._persistent ? localStores : sessionStores;
        if (evt.data.type === 'set') {
            if (storage[clientId]) Observer.set(storage[clientId], evt.data.name, evt.data.value, { detail: { noSync: true } });
        } else if (evt.data.type === 'deletion') {
            if (storage[clientId]) Observer.deleteProperty(storage[clientId], evt.data.name, { detail: { noSync: true } });
        }
        // --------------------------

        // --------------------------
        // Relay to other clients
        if (evt.data._persistent) {
            relay(evt, evt.data);
        }
        // --------------------------
        return;
    }
});