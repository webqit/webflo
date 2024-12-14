
/**
 * @imports
 */
import { renderHttpMessageInit } from './util-http.js';

/**
 * The xfetch Mixin
 */
const xfetch = async (url, init = {}) => {
    if (init.body) {
        const { body, headers } = renderHttpMessageInit(init);
        init = { ...init, body, headers, };
    }
    let response = await fetch(url, init), encoding;
    if (init.decompress === false && (encoding = response.headers.get('Content-Encoding'))) {
        let recompressedBody = response.body.pipeThrough(new CompressionStream(encoding));
        response = new Response(recompressedBody, response);
    }
    return response;
};

export default xfetch;