import { WebfloServer } from './WebfloServer.js';

export async function start() {
    const instance = WebfloServer.create(this || {});
    await instance.initialize();
}

export {
    WebfloServer
}
