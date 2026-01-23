import { WebfloRootClientA } from './WebfloRootClientA.js';
import { WebfloRootClientB } from './WebfloRootClientB.js';
import { defineElement } from './webflo-embedded.js';
import { defineElements } from './webflo-elements.js';

export async function start(bootstrap) {
    const WebfloRootClient = window.navigation ? WebfloRootClientB : WebfloRootClientA;
    const instance = WebfloRootClient.create(bootstrap, document);
    await instance.initialize();

    defineElement();
    defineElements();
    
    return instance;
}
