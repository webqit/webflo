# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a *web*, *mobile*, and *API backend* JavaScript framework built for modern *application flows*! It lets you express your entire application flow as just a layout of functions - drawn on the filesystem, composable to your heart's content 🍉!

+ [Overview](#overview)
+ [Concepts](#concepts)

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
├⏤ index.js --------------------------------- http://localhost:3000
└── products/index.js ------------------------ http://localhost:3000/products
      └── stickers/index.js ------------------ http://localhost:3000/products/stickers
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

+ [Handler Functions and Layout](#handler-functions-and-layout)
+ [Step Functions and Workflows](#step-functions-and-workflows)

### Handler Functions and Layout

Applications are often either *server-based*, *browser-based*, or a combination of both. Webflo gives us one consistent way to handle routing in all cases: using *handler functions*!

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
> <br>The above function is built as part of your application's JS bundle on calling `webflo generate` on the command line. Then it runs in-browser on navigating to http://localhost:3000 on the browser.

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
> <br>The above function is built as part of your application's Service Worker JS bundle on calling `webflo generate` on the command line. Then it runs in the Service Worker on navigating to http://localhost:3000 on the browser.

So, depending on what's being built, an application's handler functions may take the form:

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

Static files, e.g. images, stylesheets, etc, have their place in a files directory named `public`.

```shell
public
  ├⏤ logo.png
```

### Step Functions and Workflows

Whether routing in the `/client`, `/worker`, or `/server` directory above, nested URLs follow the concept of Step Functions! As seen earlier, these are parent-child arrangements of handlers that correspond to an URL strucuture.

```shell
server
  ├⏤ index.js --------------------------------- http://localhost:3000
  └── products/index.js ------------------------ http://localhost:3000/products
        └── stickers/index.js ------------------ http://localhost:3000/products/stickers
```

Each handler calls a `next()` function to propagate flow to the next step, if any; is able to pass a `context` object along, and can *recompose* the step's return value.

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

This step-based workflow helps to decomplicate routing and navigation, and gets us scaling horizontally as an application grows larger.

Workflows may be designed with as many or as few step functions as necessary; the flow control parameters `next.stepname` and `next.pathname` can be used at any point to handle the rest of the URL steps that have no corresponding step functions.

This means that we could even handle all URLs from the root handler alone.

```js
/**
server
 ├⏤ index.js
 */
export default function(event, context, next) {
    // For http://localhost:3000/products
    if (next.pathname === 'products') {
        return { title: 'Products' };
    }

    // For http://localhost:3000/products/stickers
    if (next.pathname === 'products/stickers') {
        return { title: 'Stickers' };
    }
    
    // Should we later support other URLs like static assets http://localhost:3000/logo.png
    if (next.pathname) {
        return next();
    }
    
    return { title: 'Home' };
}
```

Something interesting happens when `next()` is called where there is no destination step function ahead: Webflo takes the default action! For workflows in **the `/server` directory**, the *default action* is to go match a static file in the `public` directory.

So, above, should our handler receive static file requests like `http://localhost:3000/logo.png`, the expression `return next()` would get Webflo to match and return a logo at `public/logo.png`, if any; a `404` response otherwise.

```shell
my-app
  ├⏤ server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>The root handler effectively becomes the single point of entry to the application - being that it sees even static requests!

Now, for workflows in **the `/worker` directory**, the *default action* of a call to `next()` (where there is no destination step function ahead) is to send the request through the network to the server. But Webflo will know to attempt resolving the request from the application's caching options built into the Service Worker.

So, above, if we defined handler functions in the `/worker` directory, we could decide to either handle the received requests or just `next()` them to the server.

```js
/**
worker
 ├⏤ index.js
 */
export default async function(event, context, next) {
    // For http://localhost:3000/about
    if (next.pathname === 'about') {
        return {
            name: 'FluffyPets',
            version: '1.0',
        };
    }
    
    // For http://localhost:3000/logo.png
    if (next.pathname === 'logo.png') {
        let response = await next();
        console.log( 'Logo file size:', response.headers.get('Content-Length') );
        return response;
    }
    
    return next();
}
```

Our overall workflow now takes the following layout-to-URL mapping:

```shell
my-app
  ├⏤ worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├⏤ server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>Handlers in the `/worker` directory are only designed to see Same-Origin requests since external URLs like `https://auth.example.com/oauth` do not belong in the application's layout! External URLs, however, benefit from the application's caching options built into the Service Worker.

Lastly, for workflows in **the `/client` directory**, the *default action* of a call to `next()` (where there is no destination step function ahead) is to send the request through the network to the server. But where there is a Service Worker layer, then that becomes the next destination.

So, above, if we defined handler functions in the `/client` directory, we could decide to either handle the navigation requests in-browser or just `next()` them - this time to the Service Worker.

```js
/**
client
 ├⏤ index.js
 */
export default async function(event, context, next) {
    // For http://localhost:3000/login
    if (next.pathname === 'login') {
        window.location = 'https://auth.example.com/oauth';
        return;
    }
    
    return next();
}
```

Our overall workflow now takes the following layout-to-URL mapping:

```shell
my-app
  ├⏤ client/index.js ------------------------- http://localhost:3000/login
  ├⏤ worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├⏤ server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

If there's anything we have now, it's the ability to break work down, optionally across step functions, optionally between layers!
