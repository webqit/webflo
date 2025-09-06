import { renderHttpMessageInit } from './message.js';

const nativeFetch = fetch;
export async function fetch(url, init = {}) {
    return await nativeFetch(url);
    if (init.body) {
        const { body, headers } = renderHttpMessageInit(init);
        init = { ...init, body, headers, };
    }
    let response = await nativeFetch(url, init), encoding;
    if (init.decompress === false && (encoding = response.headers.get('Content-Encoding'))) {
        const recompressedBody = response.body.pipeThrough(new CompressionStream(encoding));
        response = new Response(recompressedBody, response);
    }
    return response;
}
