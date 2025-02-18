import { WebfloWorker } from './WebfloWorker.js';

export async function start() {
    const instance = WebfloWorker.create(this || {});
    await instance.initialize();
    return instance;
}

export {
    WebfloWorker
}
