
/**
 * The xfetch Mixin
 */
const xfetch = (whatwagFetch, xRequest = null) => {
    return (url, init = {}) => {
        if (init.body && (typeof init.body === 'object') && xRequest) {
            return whatwagFetch(new xRequest(url, init));
        }
        return whatwagFetch(url, init);
    }
};

export default xfetch;