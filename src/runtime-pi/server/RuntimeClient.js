
/**
 * imports
 */
import Fs from 'fs';
import Path from 'path';
import QueryString from 'querystring';
import Router from './Router.js';
import _RuntimeClient from '../RuntimeClient.js';

export default class RuntimeClient extends _RuntimeClient {

    /**
     * RuntimeClient
     * 
     * @param Context cx
     */
    constructor(cx) {
        super(cx);
        this.renderFileCache = {};
    }

	// Returns router class
	get Router() {
		return Router;
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
        const router = new this.Router(this.cx, httpEvent.url.pathname);
        const handle = async () => {
            // --------
            // ROUTE FOR DATA
            // --------
            const httpMethodName = httpEvent.request.method.toUpperCase();
            let response = await router.route([httpMethodName, 'default'], httpEvent, {}, async event => {
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
                if (typeof rendering !== 'string' && !(typeof rendering === 'object' && rendering && typeof rendering.toString === 'function')) {
                    throw new Error('render() must return a string response or an object that implements toString()..');
                }
                response = new httpEvent.Response(rendering.toString(), {
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
        let data = await response.jsonfy();
        let rendering = await router.route('render', httpEvent, data, async (httpEvent, data) => {
            var renderFile, pathnameSplit = httpEvent.url.pathname.split('/');
            while ((renderFile = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, './' + pathnameSplit.join('/'), 'index.html')) 
            && (this.renderFileCache[renderFile] === false/* false on previous runs */ || !Fs.existsSync(renderFile))) {
                this.renderFileCache[renderFile] = false;
                pathnameSplit.pop();
            }
            const instanceParams = QueryString.stringify({
                file: renderFile,
                url: httpEvent.url.href,
                root: this.cx.CWD,
                oohtml_level: this.cx.server.oohtml_support,
            });
            const { window } = await import('@webqit/oohtml-ssr/instance.js?' + instanceParams);
            // --------
            // OOHTML would waiting for DOM-ready in order to be initialized
            if (window.WebQit.DOM) {
                await new Promise(res => window.WebQit.DOM.ready(res));
            }
            if (window.document.templates) {
                await new Promise(res => (window.document.templatesReadyState === 'complete' && res(), window.document.addEventListener('templatesreadystatechange', res)));
            }
            if (window.document.state) {
                if (!window.document.state.env) {
                    window.document.setState({
                        env: 'server',
                    }, { update: true });
                }
                window.document.setState({ data, url: httpEvent.url }, { update: 'merge' });
            }
            if (window.document.templates) {
                window.document.body.setAttribute('template', 'routes/' + httpEvent.url.pathname.split('/').filter(a => a).map(a => a + '+-').join('/'));
            }
            await new Promise(res => setTimeout(res, 10));
            return window;
        });
        return rendering + '';
    }

}