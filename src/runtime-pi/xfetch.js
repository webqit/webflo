
/**
 * The xfetch Mixin
 */
const xfetch = (whatwagFetch, xRequest) => {
    return (url, init = {}) => {
        if (init.body && (typeof init.body === 'object')) {
            return whatwagFetch(new xRequest(url, init));
        }
        return whatwagFetch(url, init);
    }
};

export default xfetch;