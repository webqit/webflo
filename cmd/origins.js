
/**
 * imports
 */
import Fs from 'fs';
import { exec } from 'child_process';
import _any from '@webqit/util/arr/any.js';
import _isObject from '@webqit/util/js/isObject.js';
import SimpleGit from 'simple-git';
import Webhooks from '@octokit/webhooks';
import * as origins from '../config/origins.js'

/**
 * @description
 */
export const desc = {
    deploy: 'Deploys a remote origin into the local directory.',
};

/**
 * @deploy
 */
export async function deploy(Ui, origin, setup = {}) {
    if (!_isObject(origin)) {
        if (!origin) {
            throw new Error(`Please provide a repository name.`);
        }
        const matches = await origins.match(origin, setup);
        if (matches.length > 1) {
            throw new Error(`Cannot deploy ${origin}: Multiple deploy settings found.`);
        }
        if (!matches.length) {
            throw new Error(`Cannot deploy ${origin}: No deploy settings found.`);
        }
        origin = matches[0];
    }
    // ---------------
    // Instance
    const git = SimpleGit();
    // Before calling git.init()
    var isNewDeployPath = !Fs.existsSync((origin.deploy_path || '') + '/.git');
    if (origin.deploy_path) {
        if (!Fs.existsSync(origin.deploy_path)) {
            Fs.mkdirSync(origin.deploy_path, {recursive: true});
        }
        git.cwd(origin.deploy_path);
    }
    // Must come after git.cwd()
    git.init();

    const hosts = {
        github: 'https://github.com',
    };
    const url = hosts[origin.host] + '/' + origin.repo + '.git';

    // Deployment
    const pull = async () => {
        Ui.log('');
        const waiting = Ui.waiting(Ui.f`Deploying ${origin.tag}`);
        waiting.start();
        await git.reset('hard');
        return git.pull(origin.tag, origin.branch)
            .then(() => {
                waiting.stop();
                Ui.success(Ui.f`[${Ui.style.comment((new Date).toUTCString())}] Successfully deployed ${origin.tag + '@' + origin.branch} - ${url} to ${origin.deploy_path}!`);
                if (origin.ondeploy) {
                    Ui.success(Ui.f`[ondeploy] ${origin.ondeploy}`);
                    const cwd = process.cwd();
                    process.chdir(origin.deploy_path);
                    return new Promise((resolve, reject) => {
                        exec(origin.ondeploy, (error, stdout, stderr) => {
                            if (error) {
                                reject(error);
                                return;
                            }
                            if (stderr) {
                                Ui.log(stderr);
                                return;
                            }
                            Ui.log(stdout);
                            process.chdir(cwd);
                            resolve();
                        });
                    });
                }
            }).catch(err => {
                waiting.stop();
                Ui.error(err);
            });
    };

    // Remote setup
    return git.getRemotes().then(remotes => {
        if (!_any(remotes, remote => remote.name === origin.tag)
        // But if the folder was deleted and created anew,
        // the above would still hold true, so we detect that here
        || isNewDeployPath) {
            return git.addRemote(origin.tag, url)
                .then(() => {
                    Ui.log('');
                    Ui.info(Ui.f`Added new origin - ${origin.tag}: ${url}`);
                    return pull();
                })
                .catch(err => Ui.error(err));
        } else {
            return pull();
        }
    });
};

/**
 * @hook
 */
export function hook(Ui, request, response, setup = {}) {
    return new Promise(async (resolve, reject) => {
        const eventHandler = Webhooks.createEventHandler();
        eventHandler.on('push', async ({ name, payload }) => {
            const matches = (await origins.match(payload.repository.full_name, setup)).filter(o => o.autodeploy);
            var deployParams;
            if (!(deployParams = matches[0])) {
                return;
            }
            if (matches.length > 1) {
                reject(`Failed deploy attempt (${payload.repository.full_name}): Multiple deploy settings found.`);
            }
            if (!deployParams.autodeploy_secret) {
                reject(`Failed deploy attempt (${payload.repository.full_name}): The deploy settings do not contain a secret.`);
            }
            if (!Webhooks.verify(deployParams.autodeploy_secret, payload, request.headers['x-hub-signature'])) {
                reject(`Failed deploy attempt (${payload.repository.full_name}): Signature mismatch.`);
            }
            if (payload.repository.disabled || payload.repository.archived) {
                reject(`Failed deploy attempt (${payload.repository.full_name}): Repository disabled or archived.`);
            }
            Ui.log('---------------------------');
            await deploy(Ui, deployParams);
            Ui.log('');
            Ui.log('---------------------------');
            resolve(true);
        });
        if (request.headers['user-agent'] && request.headers['user-agent'].startsWith('GitHub-Hookshot/')) {
            eventHandler.receive({
                id: request.headers['x-github-delivery'],
                name: request.headers['x-github-event'],
                payload: await request.inputs(),
            }).catch(reject);
        }
    });
};