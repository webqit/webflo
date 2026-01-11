import { WebfloRootClientA } from './WebfloRootClientA.js';
import { WebfloRootClientB } from './WebfloRootClientB.js';
import { WebfloSubClient } from './WebfloSubClient.js';

export async function start(bootstrap) {
    const WebfloRootClient = window.navigation ? WebfloRootClientB : WebfloRootClientA;
    const instance = WebfloRootClient.create(bootstrap, document);
    await instance.initialize();
    WebfloSubClient.defineElement();
    return instance;
}
