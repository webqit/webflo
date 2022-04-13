
/**
 * @imports
 */
import _NavigationEvent from '../_NavigationEvent.js';
import _FormData from '../_FormData.js';

/**
 * The ClientNavigationEvent class
 */
export default _NavigationEvent({
    URL,
    Request,
    Response,
    Headers,
    FormData: _FormData(FormData),
    File,
    Blob,
    ReadableStream,
    fetch,
});
