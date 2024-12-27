import { WebfloClient } from './WebfloClient.js';
import { WebfloClientNext } from './WebfloClientNext.js';

export function start() {
    const Controller = window.navigation ? WebfloClientNext : WebfloClient;
    const instance = Controller.create(document, this || {});
    instance.initialize();
}

export { WebfloEmbedded } from './WebfloEmbedded.js';
export {
    WebfloClient,
    WebfloClientNext
}
