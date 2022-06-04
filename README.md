# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a JavaScript framework for decomplicating modern *application flows* - across web, mobile, and API backends! It lets you express your entire application flow as just a layout of functions drawn on the filesystem, composable to your heart's content 🍉!

You get functions like the below as your building block.

```js
index.js  -  export default function(event, context, next) { return { title: 'Home' } }
```
  
You nest them as *step functions* following your application's URL structure.

```js
products
  ├⏤index.js  -  export default function(event, context, next) { return { title: 'Products' } }
```
  
You determine the control flow...

```js
// index.js
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Home' };
}
```

```js
// products/index.js
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Products' };
}
```
    
...along with *all sorts of composition* along the way.

```js
// index.js
export default async function(event, context, next) {
    if (next.stepname) {
        let childContext = { user: { id: 2 }, };
        let childResponse = await next( childContext );
        return { ...childResponse, title: childResponse.title + ' | FluffyPets' };
    }
    return { title: 'Home | FluffyPets' };
}
```

This gives you all sorts of ways to be *creative* with your application URLs! 😎

## Concepts
