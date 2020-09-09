
/**
 * imports
 */
import Http from 'http';
import Chalk from 'chalk';
import _isObject from '@web-native-js/commons/js/isObject.js';
import _promise from '@web-native-js/commons/js/promise.js';
import createBrowser from './createBrowser.js';
import Router from './Router.js';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {

    if (params.showRequestLog) {
        console.log(Chalk.whiteBright('Request log:'));
        console.log('');
    }

    // -------------------
    // Create server
    // -------------------

    const router = new Router(params);
    const route = async (request, response) => {

        try {
            // Makes a global window available, even for route handlers
            // But will throw on static serve mode where an actual HTML file is not
            // in params
            var { document, jsdomInstance } = await createBrowser(params, request);
        } catch(e) {}
        var data = await router.route(request, response);
        
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
                    var requestPath = request.url.split('?')[0];
                    document.body.setAttribute('template', (params.templateRoutePath || 'app') + (requestPath));
                    document.bind(data, {update:true});
                    // Allow common async tasks to complete
                    setTimeout(() => {
                        resolve({
                            contentType: 'text/html',
                            content: jsdomInstance.serialize(),
                        });
                    }, params.renderDuration || 100);
                });
                
            });
        }

        return data;
    };

    // -------------------
    // Create server
    // -------------------

    Http.createServer(async function (request, response) {

        var fatal, data;
        try {
            data = await route(request, response);
            if (!response.headersSent) {
                if (data) {
                    response.setHeader('Content-type', data.contentType);
                    response.end(
                        data.contentType === 'application/json' && _isObject(data.content) 
                            ? JSON.stringify(data.content) 
                            : data.content
                    );    
                } else {
                    var requestPath = request.url.split('?')[0];
                    if (requestPath.lastIndexOf('.') < requestPath.lastIndexOf('/')) {
                        response.statusCode = 500;
                        response.end(`Internal server error!`);
                    } else {
                        response.statusCode = 404;
                        response.end(`${request.url} not found!`);
                    }
                }
            }
        } catch(e) {
            fatal = e;
            response.statusCode = e.errorCode || 500;
            response.end(`Internal server error!`);
        }

        if (params.showRequestLog) {
            console.log(
                Chalk.green(request.method) + ' '
                + request.url + (data && data.autoIndex ? Chalk.gray((!request.url.endsWith('/') ? '/' : '') + data.autoIndex) : '') + ' '
                + (data ? ' (' + data.contentType + ') ' : '')
                + (
                    [404, 500].includes(response.statusCode) 
                    ? Chalk.redBright(response.statusCode + (fatal ? ` [ERROR]: ${fatal.error || fatal.toString()}` : ``)) 
                    : Chalk.green(response.statusCode) + ((response.statusCode + '').startsWith('3') ? ' - ' + response.getHeader('location') : '')
                )
            );
        }

        if (fatal) {
            process.exit();
        }

    }).listen(parseInt(params.port));

};
