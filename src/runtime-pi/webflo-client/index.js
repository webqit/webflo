import { WebfloRootClient1 } from './WebfloRootClient1.js';
import { WebfloRootClient2 } from './WebfloRootClient2.js';
import { WebfloSubClient } from './WebfloSubClient.js';

export async function start() {
    const WebfloRootClient = window.navigation ? WebfloRootClient2 : WebfloRootClient1;
    const instance = WebfloRootClient.create(this || {}, document);
    await instance.initialize();
    WebfloSubClient.defineElement();
    return instance;
}

export {
    WebfloRootClient1,
    WebfloRootClient2,
    WebfloSubClient
}
