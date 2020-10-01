
/**
 * imports
 */
import execDeploy from './execDeploy.js';

/**
 * ----------
 * Adds new directives
 * ----------
 */
export function deploy(params) {
    execDeploy(params);
};

/**
 * @description
 */
export const desc = {
    deploy: 'Deploys a remote repo into the current working directory.',
};