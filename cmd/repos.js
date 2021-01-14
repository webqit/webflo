
/**
 * imports
 */
import Fs from 'fs';
import _any from '@webqit/util/arr/any.js';
import _isObject from '@webqit/util/js/isObject.js';
import SimpleGit from 'simple-git';
import Webhooks from '@octokit/webhooks';
import * as repos from '../config/repos.js'

/**
 * @description
 */
export const desc = {
    deploy: 'Deploys a remote repo into the local directory.',
};

/**
 * @deploy
 */
export async function deploy(Ui, repo, params = {}) {
    if (!_isObject(repo)) {
        if (!repo) {
            throw new Error(`Please provide a repository name.`);
        }
        const matches = await repos.match(repo, params);
        if (matches.length > 1) {
            throw new Error(`Cannot deploy ${repo}: Multiple deploy settings found.`);
        }
        if (!matches.length) {
            throw new Error(`Cannot deploy ${repo}: No deploy settings found.`);
        }
        repo = matches[0];
    }
    // ---------------
    // Instance
    const git = SimpleGit();
    // Before calling git.init()
    var isNewDeployPath = !Fs.existsSync((repo.DEPLOY_PATH || '') + '/.git');
    if (repo.DEPLOY_PATH) {
        if (!Fs.existsSync(repo.DEPLOY_PATH)) {
            Fs.mkdirSync(repo.DEPLOY_PATH, {recursive: true});
        }
        git.cwd(repo.DEPLOY_PATH);
    }
    // Must come after git.cwd()
    git.init();

    const hosts = {
        github: 'https://github.com',
    };
    const url = hosts[repo.HOST] + '/' + repo.REPO + '.git';

    // Deployment
    const pull = async () => {
        Ui.log('');
        const waiting = Ui.waiting(Ui.f`Deploying ${repo.TAG}`);
        const completed = () => {
            waiting.stop();
        };
        waiting.start();
        await git.reset('hard');
        return git.pull(repo.TAG, repo.BRANCH)
            .then(() => {
                completed();
                Ui.success(Ui.f`Successfully deployed ${repo.TAG + '@' + repo.BRANCH} - ${url} to ${repo.DEPLOY_PATH}!`);
            }).catch(err => {
                completed();
                Ui.error(err);
            });
    };

    // Remote setup
    return git.getRemotes().then(remotes => {
        if (!_any(remotes, remote => remote.name === repo.TAG)
        // But if the folder was deleted and created anew,
        // the above would still hold true, so we detect that here
        || isNewDeployPath) {
            return git.addRemote(repo.TAG, url)
                .then(() => {
                    Ui.log('');
                    Ui.info(Ui.f`Added new repo - ${repo.TAG}: ${url}`);
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
export function hook(Ui, request, response, params = {}) {
    return new Promise(async (resolve, reject) => {
        const eventHandler = Webhooks.createEventHandler();
        eventHandler.on('push', async ({ name, payload }) => {
            const matches = await repos.match(payload.repository.full_name, params);
            if (matches.length > 1) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Multiple deploy settings found.`);
            }
            var deployParams;
            if (!(deployParams = matches[0])) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): No deploy settings found.`);
            }
            if (!deployParams.AUTO_DEPLOY) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Auto-deploy disabled.`);
            }
            if (!deployParams.AUTO_DEPLOY_SECRET) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): The deploy settings do not contain a secret.`);
            }
            if (!Webhooks.verify(deployParams.AUTO_DEPLOY_SECRET, payload, request.headers['x-hub-signature'])) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Signature mismatch.`);
            }
            if (payload.repository.disabled || payload.repository.archived) {
                throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Repository disabled or archived.`);
            }
            Ui.log('---------------------------');
            await deploy(Ui, deployParams);
            Ui.log('');
            Ui.log('---------------------------');
            resolve();
        });
        if (request.headers['user-agent'].startsWith('GitHub-Hookshot/')) {
            eventHandler.receive({
                id: request.headers['x-github-delivery'],
                name: request.headers['x-github-event'],
                payload: await request.inputs(),
            }).catch(reject);
        }
    });
};