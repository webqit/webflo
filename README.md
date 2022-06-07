# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a *web*, *mobile*, and *API backend* JavaScript framework built for modern *application flows*! It lets you express your entire application flow as just a layout of functions - drawn on the filesystem, composable to your heart's content 🍉!

+ [Overview](#overview)
+ [Installation](#installation)
+ [Concepts](#concepts)

## Overview

Webflo lets you layout your application using functions as your building blocks, each defined in an `index.js` file.

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

## Installation

Every Webflo project starts on an empty directory that you can create on your machine. The command below will make a new directory `my-app` from the terminal and navigate into it.

```shell
mkdir my-app
cd my-app
```

With [npm available on your terminal](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), the following command will install Webflo to your project:

> System Requirements: Node.js 12.0 or later

```shell
$ npm i @webqit/webflo
```

The installation automatically creates a `package.json` file at project root, containing `@webqit/webflo` as a project dependency.

```json
{
  "dependencies": {
    "@webqit/webflo": "..."
  }
}
```

Other important definitions like project name, package type, and aliases for common Webflo commands will also belong in this file.

```json
{
  "name": "my-app",
  "type": "module",
  "scripts": {
    "start": "webflo start::server --mode=dev",
    "generate": "webflo generate::client"
  },
  "dependencies": {
    "@webqit/webflo": "..."
  }
}
```

All is now set! The commands `npm start` and `npm run generate` will be coming in often during development.

### "Hello World!"

To be sure that Webflo is listening, run `npx webflo help` on the terminal. An overview of available commands will be shown.

If you can't wait to say *Hello World!* 😅, you can have an HTML page say that right now!
+ Create an `index.html` file in a new directory `public`.
  
  ```shell
  public
    └── index.html
  ```
  
  ```html
  <!DOCTYPE html>
  <html>
      <head>
          <title>My App</title>
      </head>
      <body>
          <h1>Hello World!</h1>
          <p>This is <b>My App</b></p>
      </body>
  </html>
  ```
  
+ Start the Webflo server and navigate to `http://localhost:3000` on your browser to see your page.

  ```bash
  $ npm start
  ```

## Concepts

+ [Handler Functions and Layout](#handler-functions-and-layout)
+ [Step Functions and Workflows](#step-functions-and-workflows)
+ [Requests and Responses](#requests-and-responses)
+ [Rendering and Templating](#rendering-and-templating)
+ [Web Standards](#web-standards)

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
> <br>The above function runs on calling `npm start` on your terminal and visiting http://localhost:3000.

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
> <br>The above function is built as part of your application's JS bundle on calling `npm run generate` on your terminal. Then it runs in-browser on visiting http://localhost:3000.

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
> <br>The above function is built as part of your application's Service Worker JS bundle on calling `npm run generate` on your terminal. Then it runs in the Service Worker on visiting http://localhost:3000.

So, depending on what's being built, an application's handler functions may be laid out like:

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
        return {
            name: 'John Doe',
            role: 'owner',
        };
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

### Requests and Responses

Routes in Webflo can be designed for different types of request/response scenarios.

Generally, handler functions can return any type of jsonfyable data (`string`, `number`, `boolean`, `object`, `array`), or an instance of `event.Response` containing anything (e.g. blob). A nested handler's return value goes as-is to its parent handler, where it gets a chance to be recomposed. Whatever is obtained from the root handler is sent:
+ either into the response stream (in the case of the server-side root handler - `/server/index.js`, and the worker-layer root handler - `/worker/index.js`, with jsonfyable data automatically converted to a proper JSON response),
+ or into an HTML document for rendering (in the case of Server-Side Rendering (SSR), and Client-Side Rendering (CSR)).

But, whenever response is `undefined`:
+ it is either that a `404` HTTP response is returned (in the case of the server-side root handler - `/server/index.js`, and the worker-layer root handler - `/worker/index.js`),
+ or that the current HTML document receives empty data, and, at the same time, set to an error state (in the case of Server-Side Rendering (SSR), and Client-Side Rendering (CSR)),

#### Server-Side: API and Page Responses

On the server, jsonfyable response effectively becomes a *JSON API response*! (So, we get an API backend this way by default.)

```js
/**
server
 ├⏤ index.js
 */
export default async function(event, context, next) {
    return { title: 'Home | FluffyPets' };
}
```

But, for a route that is intended to *also* be accessed as a web page, data obtained as JSON objects (as in above) can get automatically rendered to HTML as a *page* response. Incoming requests are identified as *page requests* when they indicate in their `Accept` header that HTML responses are acceptable - `Accept: text/html,etc` - (browsers automatically do this on navigation requests). And, it should be either that a custom renderer has been defined on the route, or that an HTML file that pairs with the route exists in the `/public` directory - for automatic rendering by Webflo.

+ Custom renderers are functions exported as `render` (`export function render() {}`) from the same `index.js` file as the route handler.

  ```js
  /**
  server
   ├⏤ index.js
   */
  export default async function(event, context, next) {
      return { title: 'Home | FluffyPets' };
  }
  export async function render(event, data, next) {
      // For nested routes that defined their own renderer
      if (next.stepname) {
          return next();
      }
      return `
      <!DOCTYPE html>
      <html>
          <head><title>FluffyPets</title></head>
          <body>
              <h1>${ data.title }</h1>
          </body>
      </html>
      `;
  }
  ```
    
  > **Note**
  > <br>Custom renderers are step functions too and may be nested to form a *render* workflow. Nested routes, however, may not always need to have an equivalent`render` function; they automatically inherit one from their parent or ancestor.

+ Automatically-renderable HTML files are valid HTML documents named `index.html` in the `/public` directory, or a subdirectory that corresponds with the route.
   
  ```js
  /**
  server
   ├⏤ index.js
   */
  export default async function(event, context, next) {
      return { title: 'Home | FluffyPets' };
  }
  ```
  
  The data obtained above is simply sent into the loaded HTML document instance as `document.state.page`. This makes it globally accessible to embedded scripts and rendering logic! (Details in [Rendering and Templating](#rendering-and-templating).)

  ```html
   <!--
   public
    ├⏤ index.html
   -->
   <!DOCTYPE html>
   <html>
       <head><title>FluffyPets</title></head>
       <body namespace>
           <h1 data-id="headline"></h1>

           <script type="subscript">
            this.namespace.headline = document.state.page.title;
           </script>
       </body>
   </html>
  ```

  > **Note**
  > <br>Nested routes may not always need to have an equivalent `index.html` file; they automatically inherit one from their parent or ancestor.

#### Client-Side: Navigation Responses

On the client (the browser), every navigation event (page-to-page navigation, history back and forward navigation, and form submissions) initiates a request/response flow. The request object Webflo generates for these navigations is assigned an `Accept: application/json` header, so that data can be obtained as a JSON object. This request goes through the route's workflow (whether in the `/client`, `/worker`, or `/server` layer), and the JSON data obtained is simply sent into the already running HTML document as `document.state.page`. This makes it globally accessible to embedded scripts and rendering logic! (Details in [Rendering and Templating](#rendering-and-templating).)

### Rendering and Templating

As covered just above, routes that are intended to be accessed as a web page are expected to *first* be accessible as a JSON endpoint (returning an object). On the server, rendering happens *after* data is obtained from the workflow, but only when the browser explicitly asks for a `text/html` response! On the client, rendering happens *after* data is obtained from the workflow on each navigation event, but right into the same loaded document in the window. In both cases, the concept of *templating* with HTML documents makes it possible to get pages to be as unique, or as generic, as needed.
