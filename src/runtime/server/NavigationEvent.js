
/**
 * @imports
 */
import { URL } from 'url';
import { Readable } from "stream";
import { FormData, File, Blob } from 'formdata-node';
import { FormDataEncoder } from 'form-data-encoder';
import { Request, Response, Headers } from 'node-fetch';
import _NavigationEvent from '../_NavigationEvent.js';
import _FormData from '../_FormData.js';

/**
 * Patch MessageStream with formData()
 */
const _streamFormDataPatch = MessageStream => class extends MessageStream {

    // formData() polyfill
    async formData() {
        return null;
    }

};

/**
 * The NavigationEvent class
 */
export default _NavigationEvent({
    URL,
    Request: _streamFormDataPatch(Request),
    Response: _streamFormDataPatch(Response),
    Headers,
    FormData: _FormData(FormData),
    File,
    Blob,
    ReadableStream: Readable,
    FormDataEncoder
});
