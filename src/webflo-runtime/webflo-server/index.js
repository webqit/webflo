import { WebfloServer } from './WebfloServer.js';

export async function start(bootstrap) {
    const instance = WebfloServer.create(bootstrap);
    await instance.initialize();
    return instance;
}
