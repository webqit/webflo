import { WebfloWorker } from './WebfloWorker.js';

export function start() {
    const instance = new WebfloWorker(this || {});
    instance.initialize();
}

export {
    WebfloWorker
}
