import { WebfloRootClient1 } from './WebfloRootClient1.js';
import { WebfloRootClient2 } from './WebfloRootClient2.js';
import { WebfloSubClient } from './WebfloSubClient.js';

export function start() {
    const Controller = window.navigation ? WebfloRootClient2 : WebfloRootClient1;
    const instance = Controller.create(document, this || {});
    instance.initialize();
    WebfloSubClient.defineElement();
}

export { WebfloSubClient } from './WebfloSubClient.js';
export {
    WebfloRootClient1,
    WebfloRootClient2
}
