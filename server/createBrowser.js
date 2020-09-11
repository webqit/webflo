
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import QueryString from 'querystring';
import _isFunction from '@onephrase/util/js/isFunction.js';
import { fstat } from 'fs';

/**
 * Dynamically creates a DOM
 * and renders data on it.
 * 
 * @param object data
 * @param object url
 * @param object request
 * 
 * @return Promise
 */
export default function(params, request) {

    return new Promise(async (resolve, reject) => {

        var ssr = (_isFunction(params.ssr) ? await params.ssr() : params.ssr) || {};
        var renderingDocument = ssr.document, defaultRenderingDocument;
        if (!renderingDocument && renderingDocument !== false 
        && (defaultRenderingDocument = Path.join(params.publicDir, './index.html')) && Fs.existsSync(defaultRenderingDocument)) {
            renderingDocument = defaultRenderingDocument;
        }
        const instanceParams = QueryString.stringify({
            document: renderingDocument,
            'pretend-to-be-visual': 'pretendToBeVisual' in ssr ? ssr.pretendToBeVisual : 1,
            resources: ssr.resources || params.publicDir,
            'show-fetch-log': ssr.showFetchLog,
            localhost: ssr.host || request.headers['host'],
            'user-agent': ssr.userAgent || request.headers['user-agent'],
            g: ssr.globalWindow,
        });
        
        const { document, window, jsdomInstance } = await import('@web-native-js/browser-pie/instance.js?' + instanceParams);
        const { init, ENV } = await import('@web-native-js/chtml');
        
        // This window might be coming from the import cache
        if (!ENV.window) {
            init({}, jsdomInstance.window);
            if (ssr.bindingsCallback) {
                window.newBindings = await ssr.bindingsCallback(jsdomInstance.window, 'server') || {};
            } else {
                window.newBindings = {};
            }
        }

        resolve({
            document,
            window,
            jsdomInstance,
        });
        
    });
};
