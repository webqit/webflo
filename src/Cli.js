#!/usr/bin/env node

/**
 * @imports
 */
import { _toTitle } from '@webqit/util/str/index.js';
import { _merge, _set, _get } from '@webqit/util/obj/index.js';
import { _isClass, _isFunction, _isObject, _isEmpty, _isString } from '@webqit/util/js/index.js';
import { Promptx } from '@webqit/backpack/src/cli/Promptx.js';
import parseArgs from '@webqit/backpack/src/cli/parseArgs.js';

export default class Cli {

    /**
     * @constructor
     * 
     * @param Object api 
     */
    constructor(api) {
        this.api = api;
        this.nsSeparator = '::';
        // Generate available options
        this.availableConfigs = {};
        this.availableCommands = {};
        const discoverConfigs = (namespace, piObj) => Object.keys(piObj).forEach(name => {
            let pathname = `${name}${this.nsSeparator}${namespace}`.toLowerCase();
            if (_isClass(piObj[name])) {
                if (piObj[name]['@desc']) this.availableConfigs[pathname] = piObj[name]['@desc'];
            } else if (_isObject(piObj[name])) discoverConfigs(pathname, piObj[name]);
        });
        const discoverCommands = (namespace, piObj) => Object.keys(piObj).forEach(name => {
            let pathname = `${name}${this.nsSeparator}${namespace}`.toLowerCase();
            if (!_isClass(piObj[name]) && _isFunction(piObj[name])) {
                if (!piObj[name]['@desc']) this.availableCommands[pathname] = piObj[name]['@desc'];
            } else if (_isObject(piObj[name])) discoverCommands(pathname, piObj[name]);
        });
        Object.keys(this.api).forEach(name => {
            if (name === 'config') discoverConfigs(name, this.api[name]);
            else discoverCommands(name, this.api[name]);
        });
    }

    /**
     * @exec
     */
    async exec(cx) {
        const { command, keywords, flags, options, ellipsis } = parseArgs(process.argv);
        cx.flags = flags;
        // ------------
        if (cx.webflo.version) {
            cx.logger.log('');
            cx.logger.banner(cx.webflo.title, cx.webflo.version || '');
            cx.logger.log('');
        }
        // ------------
        if (command === 'help') {
            cx.logger.title(`> COMMAND LINE HELP`);
            cx.logger.log('');
            // ------------
            cx.logger.log(cx.logger.f`Say "webflo <${'command'}>"`);
            cx.logger.log(cx.logger.f`Where <${'command'}> is one of:`);
            cx.logger.log(cx.logger.f`${this.availableCommands}`);
            cx.logger.log('');
            // ------------
            cx.logger.log(cx.logger.f`Or say "webflo config", or "webflo config <${'path'}>"`);
            cx.logger.log(cx.logger.f`Where <${'path'}> is one of:`);
            cx.logger.log(cx.logger.f`${this.availableConfigs}`);
            cx.logger.log('');
            // ------------
            cx.logger.log(cx.logger.f`You may also refer to the Webflo DOCS as ${'https://webqit.io/tooling/webflo'}`);
            return;
        }
        // ------------
        const keywordList = Object.keys(keywords);
        const fcn = keywordList[0];
        const resolveIdentifier = (fcn, isConfig) => {
            let namespaceObj = isConfig ? this.availableConfigs : this.availableCommands;
            let matches = Object.keys(namespaceObj).filter(path => `${path}${this.nsSeparator}`.startsWith(`${fcn}${this.nsSeparator}`));
            if (matches.length === 1) {
                return matches[0];
            }
            return matches;
        };
        const pathNisplayName = path => path.split(this.nsSeparator).slice(0, -1).join(this.nsSeparator);
        const promptIdentifier = async (preselection, isConfig) => {
            let namespaceObj = isConfig ? this.availableConfigs : this.availableCommands;
            let selection = await Promptx({
                name: 'fcn',
                type: 'select',
                choices: (!_isEmpty(preselection) ? preselection : Object.keys(namespaceObj)).map(path => ({ value: path, title: pathNisplayName(path) })).concat({ value: '<' }),
                message: 'Please select a function to continue, or "<" to exit',
            }).then(d => d.fcn);
            if (selection === '<') process.exit();
            return selection;
        };
        // ------------
        let isConfig = command === 'config', _fcn = isConfig ? fcn : command, resolvedFcn;
        if (!(_fcn && _isString(resolvedFcn = resolveIdentifier(_fcn, isConfig))) || ellipsis) {
            cx.logger.title(`> webflo ${isConfig ? 'config ' : ''}${_fcn || ''}...`);
            cx.logger.log('');
            resolvedFcn = await promptIdentifier(resolvedFcn, isConfig);
        }
        cx.logger.title(`> webflo ${isConfig ? 'config ' : ''}${pathNisplayName(resolvedFcn)}`);
        cx.logger.log('');
        // ------------
        // Process command
        if (isConfig) {
            const configClass = _get(this.api, _toTitle(resolvedFcn).split(this.nsSeparator).reverse());
            const configurator = new configClass(cx);
            const config = await configurator.read();
            const givenOptionsList = Object.keys(options);
            if (givenOptionsList.length) {
                const optionsStructured = {};
                givenOptionsList.forEach(path => {
                    _set(optionsStructured, path.split('.'), options[path]);
                });
                await configurator.write(_merge(true, config, optionsStructured));
            } else {
                await Promptx(configurator.questions(config)).then(async _config => {
                    await configurator.write(_merge(true, config, _config));
                });
            }
        } else {
            const func = _get(this.api, resolvedFcn.split(this.nsSeparator).reverse());
            await func.call(cx, ...keywordList);
        }

        cx.logger.log('');
    }

}
