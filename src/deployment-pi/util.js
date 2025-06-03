import Fs from 'fs';
import Path from 'path';

function parseHostnames(hostnames) {
    return [].concat(hostnames).reduce((arr, str) => arr.concat(str.split(',')), []).map((str) => str.trim()).filter(str => str);
}

function selectHostnames(serverDefs, matchingPort = null) {
    return serverDefs.reduce((hosts, def) => hosts.length ? hosts : (((!matchingPort || def.port === matchingPort) && parseHostnames(def.hostnames)) || []), []);
}

// config.runtime

export async function readClientConfig($context) {
    if (!$context.config.runtime?.Client) {
        throw new Error(`The Client configurator "config.runtime.Client" is required in context.`);
    }
    return await (new $context.config.runtime.Client($context)).read();
}

export async function readWorkerConfig($context) {
    if (!$context.config.runtime?.client.Worker) {
        throw new Error(`The Client configurator "config.runtime.client.Worker" is required in context.`);
    }
    return await (new $context.config.runtime.client.Worker($context)).read();
}

export async function readServerConfig($context) {
    if (!$context.config.runtime?.Server) {
        throw new Error(`The Client configurator "config.runtime.Server" is required in context.`);
    }
    const serverConfig = await (new $context.config.runtime.Server($context)).read();
    serverConfig.hostnames = serverConfig.hostnames.length ? parseHostnames(serverConfig.hostnames) : ['*'];
    if (serverConfig.https.port) {
        serverConfig.https.hostnames = serverConfig.https.hostnames.length ? parseHostnames(serverConfig.https.hostnames) : ['*'];
    }
    return serverConfig;
}

export async function readHeadersConfig($context) {
    if (!$context.config.runtime?.server.Headers) {
        throw new Error(`The Client configurator "config.runtime.server.Headers" is required in context.`);
    }
    return await (new $context.config.runtime.server.Headers($context)).read();
}

export async function readRedirectsConfig($context) {
    if (!$context.config.runtime?.server.Redirects) {
        throw new Error(`The Client configurator "config.runtime.server.Redirects" is required in context.`);
    }
    return await (new $context.config.runtime.server.Redirects($context)).read();
}

// config.deployment

export async function readLayoutConfig($context) {
    if (!$context.config.deployment?.Layout) {
        throw new Error(`The Client configurator "config.deployment.Layout" is required in context.`);
    }
    const layoutConfig = await (new $context.config.deployment.Layout($context)).read();
    return Object.fromEntries(['CLIENT_DIR', 'WORKER_DIR', 'SERVER_DIR', 'PUBLIC_DIR'].map((name) => {
        return [name, Path.resolve($context.CWD || '', layoutConfig[name])];
    }));
}

export async function readEnvConfig($context) {
    if (!$context.config.deployment?.Env) {
        throw new Error(`The Client configurator "config.deployment.Env" is required in context.`);
    }
    return await (new $context.config.deployment.Env($context)).read();
}

export async function readOriginsConfig($context) {
    if (!$context.config.deployment?.Origins) {
        throw new Error(`The Client configurator "config.deployment.Origins" is required in context.`);
    }
    return await (new $context.config.deployment.Origins($context)).read();
}

export async function readProxyConfig($context) {
    if (!$context.config.deployment?.Proxy) {
        throw new Error(`The Client configurator "config.deployment.Proxy" is required in context.`);
    }
    const proxyConfig = await (new $context.config.deployment.Proxy($context)).read();
    const entries = await Promise.all(proxyConfig.entries.map(async ({ ...proxy }) => {
        if (proxy.hostnames) {
            proxy.hostnames = parseHostnames(proxy.hostnames);
        }
        if (proxy.path) {
            const $$context = $context.constructor.create($context, Path.join($context.CWD, proxy.path));
            proxy.SERVER = await (new $$context.config.runtime.Server($$context)).read();
            if (!proxy.port) {
                // Dynamically figure the local port on which this could be running
                proxy.port = proxy.SERVER.https.port || proxy.SERVER.port;
            }
            if (!proxy.proto) {
                // Dynamically figure the proto to forward the request with - to match running server
                proxy.proto = proxy.port === proxy.SERVER.https.port ? 'https' : 'http';
            }
            if (!proxy.hostnames?.length) {
                // Dynamically figure the hostnames to forward
                proxy.hostnames = selectHostnames([proxy.SERVER.https, proxy.SERVER], proxy.port);
                if (!proxy.hostnames.length) {
                    proxy.hostnames = selectHostnames([proxy.SERVER.https, proxy.SERVER]);
                }
            }
        }
        // Whether local or remote...
        if (!proxy.hostnames) {
            proxy.hostnames = ['*'];
        }
        return proxy;
    }));
    return { entries };
}

// -----------

export function scanRoots(DIR, rootFileName, offset = '') {
    return Fs.readdirSync(Path.join(DIR, offset)).reduce((roots, f) => {
        const resource = Path.join(DIR, offset, f);
        if (Fs.statSync(resource).isDirectory()) {
            const $offset = Path.join(offset, f);
            if (Fs.existsSync(Path.join(resource, rootFileName))) {
                return roots.concat($offset.replace(/\\/g, '/'));
            }
            return roots.concat(scanRoots(DIR, rootFileName, $offset));
        }
        return roots;
    }, []);
}

export function scanRouteHandlers(LAYOUT, which, callback, offset, roots = []) {
    const routingDir = LAYOUT[`${which.toUpperCase()}_DIR`];
    const dir = Path.join(routingDir, offset);
    const routeFileEnding = new RegExp(`(?:handler\\.${which}|handler)\\.js$`);
    const dedicatedRouteFileName = `handler.${which}.js`;
    const hasDedicatedRouteFile = Fs.existsSync(Path.join(dir, dedicatedRouteFileName));
    try {
        Fs.readdirSync(dir).forEach((f) => {
            const resource = Path.join(dir, f);
            const fstat = Fs.statSync(resource);
            if (fstat.isDirectory()) {
                const $offset = Path.join(offset, f).replace(/\\/g, '/');
                if (roots.includes($offset)) return;
                scanRouteHandlers(LAYOUT, which, callback, $offset, roots);
            } else {
                if (!routeFileEnding.test(f)
                    || (hasDedicatedRouteFile && f !== dedicatedRouteFileName)) return;
                callback(resource, `/${offset}`, f, fstat);
            }
        });
    } catch(e) {}
}
