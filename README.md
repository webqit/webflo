# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a *web*, *mobile*, and *API backend* JavaScript framework built for modern *application flows*! It lets you express your entire application flow as just a layout of functions - drawn on the filesystem, composable to your heart's content 🍉!

## Overview

In Webflo, functions are your building blocks, and they're typically defined in an `index.js` file.

```js
/**
 ├⏤ index.js
 */
export default function(event, context, next) {
    return { title: 'Home' };
}
```

You nest them as *step functions* in a structure that models your application's URL structure.

```shell
├⏤ index.js --------------------------------- http://localhost/
├⏤ products/index.js ------------------------ http://localhost/products
      ├⏤ stickers/index.js ------------------ http://localhost/products/stickers
```

They form a step-based workflow for your routes, with each step controlling the next...

```js
/**
 ├⏤ index.js
 */
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Home' };
}
```

```js
/**
 ├⏤ products/index.js
 */
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Products' };
}
```
    
...enabling *all sorts of composition* along the way!

```js
/**
 ├⏤ index.js
 */
export default async function(event, context, next) {
    if (next.stepname) {
        let childContext = { user: { id: 2 }, };
        let childResponse = await next( childContext );
        return { ...childResponse, title: childResponse.title + ' | FluffyPets' };
    }
    return { title: 'Home | FluffyPets' };
}
```

You get it: a new way to get *creative* with application URLs! 😎

*This and more - ahead!*

## Concepts

### Handler Functions and Layout

Applications are often either *server-based*, *browser-based*, or a combination of both. Webflo gives us one consistent way to handle routing in each case: using *handler functions*!

```js
/**
[directory]
 ├⏤ index.js
 */
export default function(event, context, next) {
}
```

Each function receives an `event` object representing the current flow.

For *server-based* applications (e.g. traditional web apps, API backends), server-side handlers go into a directory named `server`.

```js
/**
server
 ├⏤ index.js
 */
export default function(event, context, next) {
    return {
        title: 'Home | FluffyPets',
        source: 'server',
    };
}
```

> **Note**
> <br>The above function runs on calling `webflo start` on the command line and visiting http://localhost:3000.
 
For *browser-based* applications (e.g. Single Page Apps), client-side handlers go into a directory named `client`.

```js
/**
client
 ├⏤ index.js
 */
export default function(event, context, next) {
    return {
        title: 'Home | FluffyPets',
        source: 'in-browser',
    };
}
```

> **Note**
> <br>The above function is built as part of your application's JS bundle on calling `webflo generate` on the command line; then runs on navigating to http://localhost:3000 on the browser.
 
For *browser-based* applications that want to support offline usage via Service-Workers (e.g Progressive Web Apps), Webflo allows us to define equivalent handlers for requests hitting the Service Worker. These worker-based handlers go into a directory named `worker`.

```js
/**
worker
 ├⏤ index.js
 */
export default function(event, context, next) {
    return {
        title: 'Home | FluffyPets',
        source: 'service-worker',
    };
}
```

> **Note**
> <br>The above function is built as part of your application's Service Worker JS bundle on calling `webflo generate` on the command line; then runs on navigating to http://localhost:3000 on the browser.

So, depending on what's being built, an application may have any of the following handler functions.

```shell
client
  ├⏤ index.js
```

```shell
worker
  ├⏤ index.js
```

```shell
server
  ├⏤ index.js
```

### Step Functions and Workflows

Whether routing in the `/client`, `/worker`, or `/server` directory above, nested URLs follow the concept of Step Functions! As seen earlier, they are parent-child arrangements of handlers that correspond to an URL strucuture.

```shell
server
  ├⏤ index.js --------------------------------- http://localhost/
  ├⏤ products/index.js ------------------------ http://localhost/products
        ├⏤ stickers/index.js ------------------ http://localhost/products/stickers
```

Each handler calls a `next()` function to propagate flow to the next step, if any; can pass a `context` object along, and can *recompose* the step's return value.

```js
/**
server
 ├⏤ index.js
 */
export default async function(event, context, next) {
    if (next.stepname) {
        let childContext = { user: { id: 2 }, };
        let childResponse = await next( childContext );
        return { ...childResponse, title: childResponse.title + ' | FluffyPets' };
    }
    return { title: 'Home | FluffyPets' };
}
```

```js
/**
server
 ├⏤ products/index.js
 */
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Products' };
}
```

This step-based workflow helps to decomplicate routing and navigation, and gets us scaling horizontally as our application grows larger.
