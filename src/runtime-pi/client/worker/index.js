import { WebfloWorker } from './WebfloWorker.js';

export function start() {
    const instance = WebfloWorker.create(this || {});
    instance.initialize();
}

export {
    WebfloWorker
}
