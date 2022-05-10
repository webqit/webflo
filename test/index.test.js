/**
 * @imports
 */
import { config, runtime, Context } from '../src/index.js';

let client = {
    handle: function(httpEvent) {
        return new httpEvent.Response({ abcd: '1234' }, {
            status: 302,
            headers: {
                //location: '/dddd',
                cookies: {
                    cookie1: { value: 'value1' },
                    cookie2: { value: 'value2' },
                }
            }
        });
    },
};

const cx = Context.create({ config: config, });
const clientCallback = (_cx, hostName, defaultClientCallback) => client;
const app = await runtime.server.start.call(cx, clientCallback);

const response = await app.go('http://localhost/', { headers: { range: 'bytes=0-5, 6' } } );
