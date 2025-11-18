import { WebfloWorker } from './WebfloWorker.js';

export async function start(bootstrap) {
    const instance = WebfloWorker.create(bootstrap);
    await instance.initialize();
    return instance;
}