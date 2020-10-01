
/**
 * imports
 */
import execBuild from './execBuild.js';

/**
 * ----------
 * Creates the client build
 * ----------
 */
export function build(params) {
    execBuild(params);
};

/**
 * @description
 */
export const desc = {
    build: 'Creates the application Client Build.',
};