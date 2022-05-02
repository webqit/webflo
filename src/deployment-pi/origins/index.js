
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import SimpleGit from 'simple-git';
import { spawn } from 'child_process';
import { _any } from '@webqit/util/arr/index.js';
import { _beforeLast } from '@webqit/util/str/index.js';
import { _isObject } from '@webqit/util/js/index.js';
import Webhooks from '@octokit/webhooks';

/**
 * @desc
 */
export const desc = {
    deploy: 'Deploy project from a remote origin.',
};

/**
 * @deploy
 */
export async function deploy(origin) {
    const cx = this || {};
    if (!cx.config.deployment?.Origins) {
        throw new Error(`The Origins configurator "config.deployment.Origins" is required in context.`);
    }
    if (!_isObject(origin)) {
        if (!origin) {
            throw new Error(`Please provide a repository name.`);
        }
        if (origin.includes('/')) {
            if (!origin.startsWith('https://') || !origin.endsWith('.git')) {
                throw new Error(`Cannot deploy ${origin}: A valid https git repository is expected.`);
            }
            var urlSplit = _beforeLast(origin, '.git').split('/');
            var [ repo, branch ] = urlSplit.splice(-2).join('/').split(':');
            origin = {
                repo,
                branch: branch || 'master',
                host: urlSplit.pop(),
                url: origin,
                tag: repo.replace('/', '-'),
            };
        } else {
            const matches = await (new cx.config.deployment.Origins(cx)).match(origin);
            if (matches.length > 1) {
                throw new Error(`Cannot deploy ${origin}: Multiple deploy settings found.`);
            }
            if (!matches.length) {
                throw new Error(`Cannot deploy ${origin}: No deploy settings found.`);
            }
            origin = matches[0];
        }
    }
    // ---------------
    const isDeployPathSet = origin.deploy_path;
    origin.deploy_path = Path.join(cx.CWD || '', origin.deploy_path || '.');
    // ---------------
    // Instance
    const git = SimpleGit();
    // Before calling git.init()
    var isNewDeployPath = !Fs.existsSync((origin.deploy_path || '') + '/.git');
    if (isDeployPathSet) {
        if (!Fs.existsSync(origin.deploy_path)) {
            Fs.mkdirSync(origin.deploy_path, { recursive: true });
        }
    }
    await git.cwd(origin.deploy_path);
    // Must come after git.cwd()
    await git.init();

    const hosts = {
        github: 'https://github.com',
        bitbucket: 'https://bitbucket.org',
    };
    const url = origin.url || hosts[origin.host] + '/' + origin.repo + '.git';

    // Deployment
    const pull = async () => {
        let waiting;
        if (cx.logger) {
            cx.logger.log('');
            waiting = cx.logger.waiting(cx.logger.f`Deploying ${origin.tag}`);
            waiting.start();
        }
        await git.reset('hard');
        return git.pull(origin.tag, origin.branch)
            .then(() => {
                if (cx.logger) {
                    waiting.stop();
                    cx.logger.log('');
                    var _date = (new Date).toUTCString();
                    cx.logger.success(cx.logger.f`[${cx.logger.style.comment(_date)}][AUTODEPLOY] Successfully deployed: ${origin.tag + '@' + origin.branch} - ${url} to ${origin.deploy_path}!`);
                    cx.logger.success(cx.logger.f`[${cx.logger.style.comment(_date)}][AUTODEPLOY] On-deploy script: ${origin.ondeploy}!`);
                    cx.logger.log('');
                }
                if (origin.ondeploy) {
                    const run = cmd => new Promise((resolve, reject) => {
                        cmd = cmd.split(' ').map(a => a.trim()).filter(a => a);
                        const child = spawn(cmd.shift(), cmd, {
                            cwd: origin.deploy_path,
                            stdio: [ process.stdin, process.stdout, process.stderr ],
                        });
                        
                        child.on('error', error => {
                            cx.logger && cx.logger.error(error);
                            reject(error);
                        });

                        child.on('exit', async exitCode => {
                            resolve(exitCode);
                            cx.logger && cx.logger.log('');
                        });
                    });
                    return origin.ondeploy.split('&&').map(cmd => cmd.trim()).reduce(
                        async (prev, cmd) => (await prev) === 0 ? run(cmd) : prev
                    , 0);
                }
            }).catch(err => {
                if (cx.logger) {
                    waiting.stop();
                    cx.logger.error(err);
                }
            });
    };

    // Remote layout
    return git.getRemotes().then(remotes => {
        if (!_any(remotes, remote => remote.name === origin.tag)
        // But if the folder was deleted and created anew,
        // the above would still hold true, so we detect that here
        || isNewDeployPath) {
            return git.addRemote(origin.tag, url)
                .then(() => {
                    if (cx.logger) {
                        cx.logger.log('');
                        cx.logger.info(cx.logger.f`Added new origin - ${origin.tag}: ${url}`);
                    }
                    return pull();
                })
                .catch(err => cx.logger && cx.logger.error(err));
        } else {
            return pull();
        }
    });

}

/**
 * @hook
 */
export async function webhook(httpEvent, router, next) {
    const cx = this || {};
    if (!cx.config.deployment?.Origins) {
        throw new Error(`The Origins configurator "config.deployment.Origins" is required in context.`);
    }
    const webhookEventHandler = Webhooks.createEventHandler();
    if (httpEvent.request.headers.has('user-agent') && httpEvent.request.headers.get('user-agent').startsWith('GitHub-Hookshot/')) {
        const payload = await httpEvent.request.json();
        const matches = (await (new cx.config.deployment.Origins(cx)).match(payload.repository.full_name)).filter(o => o.autodeploy);
        var deployParams;
        if (!(deployParams = matches[0])) {
            return next();
        }
        if (matches.length > 1) {
            throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Multiple deploy settings found.`);
        }
        if (!deployParams.autodeploy_secret) {
            throw new Error(`Failed deploy attempt (${payload.repository.full_name}): The deploy settings do not contain a secret.`);
        }
        if (!Webhooks.verify(deployParams.autodeploy_secret, payload, httpEvent.request.headers.get('x-hub-signature'))) {
            throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Signature mismatch.`);
        }
        if (payload.repository.disabled || payload.repository.archived) {
            throw new Error(`Failed deploy attempt (${payload.repository.full_name}): Repository disabled or archived.`);
        }
        return new Promise(resolve => {
            webhookEventHandler.on('push', async ({ name, payload }) => {
                if (cx.logger) {
                    cx.logger.log('---------------------------');
                    cx.logger.log('');
                }
                var exitCode = await router.route('deploy', navigationEvent, payload, _payload => {
                    return deploy.call(cx, deployParams);
                });
                if (cx.logger) {
                    cx.logger.log('');
                    cx.logger.log('---------------------------');
                }
                if (exitCode === 0) {
                    if (cx.logger) {
                        cx.logger.log('');
                        var _date = (new Date).toUTCString();
                        cx.logger.success(cx.logger.f`[${cx.logger.style.comment(_date)}][AUTODEPLOY] Auto-exit: ${true}; exiting...`);
                        cx.logger.log('');
                    }
                    if (deployParams.ondeploy_autoexit) {
                        process.exit();
                    }
                }
                resolve(
                    new navigationEvent.Response(null, { status: exitCode === 0 ? 200 : 500 })
                );
            });
            webhookEventHandler.receive({
                id: httpEvent.request.headers.get('x-github-delivery'),
                name: httpEvent.request.headers.get('x-github-httpEvent'),
                payload: payload /* JSON object */,
            });
        });
    }

    return next();
}