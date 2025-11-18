import { WebfloRootClient1 } from './WebfloRootClient1.js';
import { WebfloRootClient2 } from './WebfloRootClient2.js';
import { WebfloSubClient } from './WebfloSubClient.js';

export async function start(bootstrap) {
    const WebfloRootClient = window.navigation ? WebfloRootClient2 : WebfloRootClient1;
    const instance = WebfloRootClient.create(bootstrap, document);
    await instance.initialize();
    WebfloSubClient.defineElement();
    return instance;
}
