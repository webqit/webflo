
/**
 * @imports
 */
import { URL } from 'url';
import { FormData, File, Blob } from 'formdata-node';
import fetch, { Request, Response, Headers } from 'node-fetch';
import { FormDataEncoder } from 'form-data-encoder';
import { Readable } from "stream";

/**
 * The NavigationEvent class
 */
if (!Request.prototype.formData) {
    Request.prototype.formData = async function() { return null }
}
if (!Response.prototype.formData) {
    Response.prototype.formData = async function() { return null }
}
FormData.encode = formData => {
    const encoder = new FormDataEncoder(formData);
    return [ Readable.from(encoder.encode()), encoder.headers ];
};

export {
    URL,
    fetch,
    Headers,
    Request,
    Response,
    FormData,
    Readable as ReadableStream,
    File,
    Blob,
}
