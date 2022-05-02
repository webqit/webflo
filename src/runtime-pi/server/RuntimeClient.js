
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import QueryString from 'querystring';
import Router from './Router.js';

export default class RuntimeClient {

    /**
     * RuntimeClient
     * 
     * @param Context cx
     */
    constructor(cx) {
        this.cx = cx;
        this.renderFileCache = {};
    }

    /**
     * Handles navigation events.
     * 
     * @param NavigationEvent       httpEvent
     * @param Function              remoteFetch
     * 
     * @return Response
     */
    async handle(httpEvent, remoteFetch) {
        // The app router
        const router = new Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
            // --------
            // ROUTE FOR DATA
            // --------
            let httpMethodName = httpEvent.request.method.toLowerCase();
            let response = await router.route([httpMethodName === 'delete' ? 'del' : httpMethodName, 'default'], httpEvent, {}, async event => {
                return router.file(event);
            }, remoteFetch);
            if (!(response instanceof httpEvent.Response)) {
                response = new httpEvent.Response(response);
            }

            // --------
            // Rendering
            // --------
            if (response.ok && response.bodyAttrs.inputType === 'object' && httpEvent.request.headers.accept.match('text/html')) {
                let rendering = await this.render(httpEvent, router, response);
                if (typeof rendering !== 'string') {
                    throw new Error('render() must return a window object or a string response.');
                }
                response = new httpEvent.Response(rendering, {
                    status: response.status,
                    headers: { ...response.headers.json(), contentType: 'text/html' },
                });
            }

            return response;
        };

        // --------
        // PIPE THROUGH MIDDLEWARES
        // --------
        return (this.cx.middlewares || []).concat(handle).reverse().reduce((next, fn) => {
            return () => fn.call(this.cx, httpEvent, router, next);
        }, null)();
    }

    // Renderer
    async render(httpEvent, router, response) {
        let data = await response.json();
        let rendering = await router.route('render', httpEvent, data, async (httpEvent, data) => {
            var renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
            && (this.renderFileCache[renderFile] === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.renderFileCache[renderFile] = false;
                pathnameSplit.pop();
            }
            const instanceParams = QueryString.stringify({
                SOURCE: renderFile,
                URL: httpEvent.url.href,
                ROOT: this.cx.CWD,
            });
            const { window } = await import('@webqit/oohtml-ssr/instance.js?' + instanceParams);
            // --------
            // OOHTML would waiting for DOM-ready in order to be initialized
            await new Promise(res => window.WebQit.DOM.ready(res));
            await new Promise(res => (window.document.templatesReadyState === 'complete' && res(), window.document.addEventListener('templatesreadystatechange', res)));
            if (!window.document.state.env) {
                window.document.setState({
                    env: 'server',
                }, { update: true });
            }
            window.document.setState({ page: data, url: httpEvent.url }, { update: 'merge' });
            window.document.body.setAttribute('template', 'page/' + httpEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
            await new Promise(res => setTimeout(res, 10));
            return window;
        });
        return rendering + '';
    }

}