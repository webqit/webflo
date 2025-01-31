import { WebfloRootClient1 } from './WebfloRootClient1.js';
import { WebfloRootClient2 } from './WebfloRootClient2.js';
import { WebfloSubClient } from './WebfloSubClient.js';

export function start() {
    const navigationAPIMeta = document.querySelector('meta[name="webflo-navigationapi"]')?.value;
    const WebfloRootClient = window.navigation && navigationAPIMeta ? WebfloRootClient2 : WebfloRootClient1;
    const instance = WebfloRootClient.create(document, this || {});
    instance.initialize();
    WebfloSubClient.defineElement();
}

export { WebfloSubClient } from './WebfloSubClient.js';
export {
    WebfloRootClient1,
    WebfloRootClient2
}
