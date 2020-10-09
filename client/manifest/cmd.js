
/**
 * imports
 */
import runBuild from './runBuild.js';

/**
 * ----------
 * Creates the client build
 * ----------
 */
export function build(params) {
    runBuild(params);
};

/**
 * @description
 */
export const desc = {
    build: 'Creates the application manifest file.',
};