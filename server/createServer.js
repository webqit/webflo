
/**
 * imports
 */
import Url from 'url';
import http from 'http';
import chalk from 'chalk';
import _isObject from '@web-native-js/commons/js/isObject.js';
import _promise from '@web-native-js/commons/js/promise.js';
import Router from './Router.js';
import createBrowser from './createBrowser.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    console.log('');
    console.log(chalk.greenBright('Server running!'));
    if (params.showRequestLog) {
        console.log('');
        console.log(chalk.whiteBright('Request log:'));
    }

    // -------------------
    // Create server
    // -------------------

    const router = new Router(params);
    const route = async request => {

        var { document, jsdomInstance } = await createBrowser(params, request);
        var data = await router.route(request);
        
        if (_isObject(data) && !data.static && !request.headers.json) {
                
            // Rendering setup
            return await _promise(resolve => {

                (new Promise(resolve => {
                    if (document.templatesReadyState === 'complete') {
                        resolve();
                    } else {
                        document.addEventListener('templatesreadystatechange', resolve);
                    }
                })).then(async () => {
                    document.body.setAttribute('template', (params.templateRoutePath || 'app') + (request.url.pathname));
                    document.bind(data, false);
                    // Allow the import to be detected
                    setTimeout(() => {
                        resolve({
                            contentType: 'text/html',
                            content: jsdomInstance.serialize(),
                        });
                    }, 5);
                });
                
            });
        }

        return data;
    };

    // -------------------
    // Create server
    // -------------------

    http.createServer(async function (request, response) {

        var fatal, data;
        var url = Url.parse(request.url), fatal;

        try {
            data = await route({url, headers:request.headers,});
            if (data) {
                response.setHeader('Content-type', data.contentType);
                response.end(
                    data.contentType === 'application/json' && _isObject(data.content) 
                        ? JSON.stringify(data.content) 
                        : data.content
                );    
            } else {
                if (url.pathname.lastIndexOf('.') < url.pathname.lastIndexOf('/')) {
                    response.statusCode = 500;
                    response.end(`Internal server error!`);
                } else {
                    response.statusCode = 404;
                    response.end(`${request.url} not found!`);
                }
            }
        } catch(e) {
            fatal = e;
            response.statusCode = e.errorCode || 500;
            response.end(`Internal server error!`);
        }

        if (params.showRequestLog) {
            console.log(
                chalk.green(request.method) + ' '
                + request.url + (data && data.autoIndex ? chalk.gray((!request.url.endsWith('/') ? '/' : '') + data.autoIndex) : '') + ' '
                + (data ? ' (' + data.contentType + ') ' : '')
                + ([404, 500].includes(response.statusCode) ? chalk.red(response.statusCode + (fatal ? ` [ERROR]: ${fatal.error || fatal.toString()}` : ``)) : chalk.green(200))
            );
        }

        if (fatal) {
            process.exit();
        }

    }).listen(parseInt(params.port));

};
