
/**
 * imports
 */
import _any from '@onephrase/util/arr/any.js';
import SimpleGit from 'simple-git';
import Chalk from 'chalk';
import Clui from 'clui';

/**
 * Initializes a server on the given working directory.
 * 
 * @param object params
 * 
 * @return void
 */
export default function(params) {
    
    // Instance
    const git = SimpleGit();
    git.init();

    // Deployment
    const pull = () => {
        console.log('');
        const spnnr = new Clui.Spinner(Chalk.whiteBright('Deploying site') + Chalk.blueBright('...'));
        spnnr.start();
        git.pull(params.NAME, params.BRANCH)
            .then(() => {
                spnnr.stop();
                console.log(Chalk.blueBright('Successfully deployed!'));
            }).catch(err => {
                spnnr.stop();
                console.error(err);
            });
    };

    // Remote setup
    git.getRemotes().then(remotes => {
        var hosts = {
            github: 'https://github.com',
        };
        if (!_any(remotes, remote => remote.name === params.NAME)) {
            var url = hosts[params.HOST] + '/' + params.ACCOUNT + '/' + params.REPO + '.git';
            git.addRemote(params.NAME, url)
                .then(() => {
                    console.log('');
                    console.log('Added ' + params.NAME + ': ' + Chalk.greenBright(url));
                    pull();
                })
                .catch(err => console.log(err));
        } else {
            pull();
        }
    })

};
