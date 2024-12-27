import { WebfloClient } from './WebfloClient.js';
import { WebfloClientNext } from './WebfloClientNext.js';
import { WebfloEmbedded } from './WebfloEmbedded.js';

export function start() {
    const Controller = window.navigation ? WebfloClientNext : WebfloClient;
    const instance = Controller.create(document, this || {});
    instance.initialize();
    WebfloEmbedded.defineElement();
}

export { WebfloEmbedded } from './WebfloEmbedded.js';
export {
    WebfloClient,
    WebfloClientNext
}
