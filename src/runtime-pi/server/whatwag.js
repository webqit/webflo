
/**
 * @imports
 */
import { URL } from 'url';
import { FormData, File, Blob } from 'formdata-node';
import fetch, { Request, Response, Headers } from 'node-fetch';
import { FormDataEncoder } from 'form-data-encoder';
import { Readable } from "stream";

/**
 * Patch MessageStream with formData()
 */
const _streamFormDataPatch = MessageStream => class extends MessageStream {
    // formData() polyfill
    async formData() { return null;  }
};

/**
 * The NavigationEvent class
 */
const Request2 = _streamFormDataPatch(Request);
const Response2 = _streamFormDataPatch(Response);
FormData.encode = formData => {
    const encoder = new FormDataEncoder(formData);
    return [ Readable.from(encoder.encode()), encoder.headers ];
};
export {
    URL,
    fetch,
    Headers,
    Request2 as Request,
    Response2 as Response,
    FormData,
    Readable as ReadableStream,
    File,
    Blob,
}
