import Fs from 'fs/promises';
import { parse, compile, matchPrologDirective, serialize } from '@webqit/use-live';

export function UseLiveTransform() {
    return {
        name: 'uselive-transform',
        setup(build) {
            build.onLoad({ filter: /\.(js|mjs|ts|jsx|tsx)$/ }, async (args) => {
                const code = await Fs.readFile(args.path, 'utf8');
                
                // Super dirty detection
                if (matchPrologDirective(code)) {
                    // Actual check...

                    let ast;
                    try { ast = parse(code, parserParams); } catch (e) { console.error(args.path, '\nUseLive transform error:', e); }
                    
                    if (ast?.isLiveProgram || ast?.hasLiveFunctions) {
                        const result = await compile(parserParams.sourceType+'-file', ast, {
                            liveMode: ast.isLiveProgram, // Regarding top-level
                            fileName: args.path,
                        });
                        return { contents: serialize(result), loader: 'js' };
                    }
                }

                return { contents: code, loader: 'default' };
            });
        }
    };
}

export const parserParams = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    executionMode: 'RegularProgram', // 'LiveProgram'
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: false,
    preserveParens: false,
    locations: true,
};
