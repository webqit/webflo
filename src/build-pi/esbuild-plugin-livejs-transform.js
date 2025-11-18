import Fs from 'fs/promises';
//import { transformQuantum } from '@webqit/quantum-js';

export function LiveJSTransform() {
    return {
        name: 'livejs-transform',
        setup(build) {
            build.onLoad({ filter: /\.(js|mjs|ts|jsx|tsx)$/ }, async (args) => {
                let code = await Fs.readFile(args.path, 'utf8');

                //console.log('LiveJS -- transform:', args);

                // super dirty detection
                if (!/\bquantum\s+function\b/.test(code) &&
                    !/\basync\s+quantum\s+function\b/.test(code)) {
                    return { contents: code, loader: 'default' };
                }

                
                console.log('LiveJS transform:', args.path);

                return { contents: code, loader: 'default' };
                const result = await transformQuantum(code, {
                    filename: args.path,
                    sourceMaps: true
                });

                return {
                    contents: result.code,
                    loader: 'js' // or 'ts' if you want esbuild TS transform after
                };
            });
        }
    };
}
