# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a *web*, *mobile*, and *API backend* JavaScript framework built for modern *application flows*! It lets you express your entire application flow as just a layout of functions - drawn on the filesystem, composable to your heart's content 🍉!

> **Note**
> <br>Webflo is notably based on a number of important web standards: [WHATWG Fetch](https://fetch.spec.whatwg.org/), [WHATWG DOM](https://dom.spec.whatwg.org/), [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), etc. It also stands out as extremely lightweight and scalable!

+ [Overview](#overview)
+ [Installation](#installation)
+ [Concepts](#concepts)

## Overview

Webflo lets you layout your application using functions as your building block, each defined in an `index.js` file.

```js
/**
 ├── index.js
 */
export default function(event, context, next) {
    return { title: 'Home' };
}
```

You nest them as *step functions* in a structure that models your application's URL structure.

```shell
├── index.js --------------------------------- http://localhost:3000
└── products/index.js ------------------------ http://localhost:3000/products
      └── stickers/index.js ------------------ http://localhost:3000/products/stickers
```

They form a step-based workflow for your routes, with each step controlling the next...

```js
/**
 ├── index.js
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
 ├── products/index.js
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
 ├── index.js
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

Other important definitions like project `name`, package `type`, and *aliases* for common Webflo commands will also belong here.

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
+ Create an `index.html` file in a new subdirectory `public`.
  
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
  
+ Start the Webflo server and visit `http://localhost:3000` on your browser to see your page. 😃

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
 ├── index.js
 */
export default function(event, context, next) {
}
```

Each function receives an `event` object representing the current flow.

For *server-based* applications (e.g. traditional web apps, API backends), server-side handlers go into a directory named `server`.

```js
/**
server
 ├── index.js
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
 ├── index.js
 */
export default function(event, context, next) {
    return {
        title: 'Home | FluffyPets',
        source: 'in-browser',
    };
}
```

> **Note**
> <br>The above function is built as part of your application's JS bundle on calling `npm run generate` on your terminal. (This is typically bundled to the file `./public/bundle.js`. So, you'd embed it as `<script type="module" src="/bundle.js"></script>`.) Then it runs in-browser on visiting http://localhost:3000.

For *browser-based* applications that want to support offline usage via Service-Workers (e.g Progressive Web Apps), Webflo allows us to define equivalent handlers for requests hitting the Service Worker. These worker-based handlers go into a directory named `worker`.

```js
/**
worker
 ├── index.js
 */
export default function(event, context, next) {
    return {
        title: 'Home | FluffyPets',
        source: 'service-worker',
    };
}
```

> **Note**
> <br>The above function is built as part of your application's Service Worker JS bundle on calling `npm run generate` on your terminal. (This is typically bundled to the file `./public/worker.js`, and the main application bundle automatically connects to it.) Then it runs within the Service Worker on visiting http://localhost:3000.

So, depending on what's being built, an application's handler functions may take the following form (in part or in whole as we'll see):

```shell
client
  ├── index.js
```

```shell
worker
  ├── index.js
```

```shell
server
  ├── index.js
```

Static files, e.g. images, stylesheets, etc, have their place in a files directory named `public`.

```shell
public
  ├── logo.png
```

### Step Functions and Workflows

Whether routing in the `/client`, `/worker`, or `/server` directory above, nested URLs follow the concept of Step Functions! As seen earlier, these are parent-child arrangements of handlers that model an URL strucuture.

```shell
server
  ├── index.js --------------------------------- http://localhost:3000
  └── products/index.js ------------------------ http://localhost:3000/products
        └── stickers/index.js ------------------ http://localhost:3000/products/stickers
```

Each handler calls a `next()` function to propagate flow to a child step, if any; is able to pass a `context` object along, and can *recompose* the child step's return value.

```js
/**
server
 ├── index.js
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
 ├── products/index.js
 */
export default function(event, context, next) {
    if (next.stepname) {
        return next();
    }
    return { title: 'Products' };
}
```

This step-based workflow helps to decomplicate routing and navigation, and gets us scaling horizontally as our application grows larger.

Workflows may be designed with as many or as few step functions as necessary; the flow control parameters `next.stepname` and `next.pathname` can be used at any point to handle the rest of an URL's steps that have no corresponding step functions.

This means that we could even handle all URLs from the root handler alone.

```js
/**
server
 ├── index.js
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
    
    // For the root URL http://localhost:3000
    return { title: 'Home' };
}
```

Something interesting happens on calling `next()` at the *edge* of the workflow - the point where there are no more child steps - as in the case above: Webflo takes the *default action*!

For workflows in **the `/server` directory**, the *default action* of `next()` at the edge is to go match and return a static file in the `public` directory.

So, above, should our handler receive static file requests like `http://localhost:3000/logo.png`, the expression `return next()` would get Webflo to match and return the logo at `public/logo.png`, if any; a `404` response otherwise.

```shell
my-app
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>The root handler effectively becomes the single point of entry to the application - being that it sees even static requests!

Now, for workflows in **the `/worker` directory**, the *default action* of `next()` at the edge is to send the request through the network to the server. (But Webflo will know to attempt resolving the request from the application's caching options built into the Service Worker.)

So, above, if we defined handler functions in the `/worker` directory, we could decide to either handle the received requests or just `next()` them to the server.

```js
/**
worker
 ├── index.js
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
    
    // For every other URL
    return next();
}
```

Now we get the following layout-to-URL mapping for our application:

```shell
my-app
  ├── worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>Handlers in the `/worker` directory are only designed to see Same-Origin requests since Cross-Origin URLs like `https://auth.example.com/oauth` do not belong in the application's layout! These external URLs, however, benefit from the application's caching options built into the Service Worker.

Lastly, for workflows in **the `/client` directory**, the *default action*  of `next()` at the edge is to send the request through the network to the server. But where there is a Service Worker layer, then that becomes the next destination.

So, above, if we defined handler functions in the `/client` directory, we could decide to either handle the navigation requests in-browser or just `next()` them, this time, to the Service Worker layer.

```js
/**
client
 ├── index.js
 */
export default async function(event, context, next) {
    // For http://localhost:3000/login
    if (next.pathname === 'login') {
        return {
            name: 'John Doe',
            role: 'owner',
        };
    }
    
    // For every other URL
    return next();
}
```

Our overall layout-to-URL mapping for this application now becomes:

```shell
my-app
  ├── client/index.js ------------------------- http://localhost:3000/login
  ├── worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

If there's anything we have now, it is the ability to break work down, optionally across step functions, optionally between layers!

### Requests and Responses

Routes in Webflo can be designed for different types of request/response scenarios.

Generally, handler functions can return any type of jsonfyable data (`string`, `number`, `boolean`, `object`, `array`), or other primitive types like `ArrayBuffer`, `Blob`, etc, or an instance of `event.Response` containing the same. (Here `event.Response` is essentially the [WHATWG Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) object, available in all environments - `/client`, `/worker`, and `/server`.)

A nested handler's return value goes as-is to its parent handler, where it gets a chance to be recomposed. Whatever is obtained from the root handler is sent:
+ either into the response stream (with jsonfyable data automatically translating to a proper JSON response),
+ or into an HTML document for rendering (where applicable), as detailed ahead.

But, where workflows return `undefined`, a `404` HTTP response is returned. (In the case of client-side workflows - in `/client`, the already running HTML page in the browser receives empty data, and, at the same time, set to an error state. Details in [Rendering and Templating](#rendering-and-templating).)

#### Server-Side: API and Page Responses

On the server, jsonfyable response effectively becomes a *JSON API response*! (So, we get an API backend this way by default.)

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    return { title: 'Home | FluffyPets' };
}
```

But, for a route that is intended to *also* be accessed as a web page, data obtained as JSON objects (as in above) can get automatically rendered to HTML as a *page* response. Incoming requests are identified as *page requests* when they indicate in their `Accept` header that HTML responses are acceptable - `Accept: text/html,etc`. (Browsers automatically do this on navigation requests.) Next, it should be either that a custom `render` callback has been defined on the route, or that an HTML file that pairs with the route exists in the `/public` directory - for automatic rendering by Webflo.

+ **Case 1: Custom `render` callbacks**. These are functions exported as `render` (`export function render() {}`) from the route.

  ```js
  /**
  server
   ├── index.js
   */
  export default async function(event, context, next) {
      return { title: 'Home | FluffyPets' };
  }
  export async function render(event, data, next) {
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
  
  But custom `render` callbacks are step functions too that may be nested as necessary to form a *render* workflow.
  
  ```js
  /**
  server
   ├── index.js
   */
  export async function render(event, data, next) {
      // For render callbacks at child step
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
  > <br>Typically, though, child steps do not always need to have an equivalent`render` callback being that they automatically inherit rendering from their parent or ancestor.

+ **Case 2: Automatically-paired HTML files**. These are valid HTML documents named `index.html` in the `/public` directory, or a subdirectory that corresponds with the route.
   
  ```js
  /**
  server
   ├── index.js
   */
  export default async function(event, context, next) {
      return { title: 'Home | FluffyPets' };
  }
  ```
  
  ```html
  <!--
  public
   ├── index.html
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
  
  The data obtained above is simply sent into the loaded HTML document instance as `document.state.page`. This makes it globally accessible to embedded scripts and rendering logic! (Details in [Rendering and Templating](#rendering-and-templating).)

  > **Note**
  > <br>Nested routes may not always need to have an equivalent `index.html` file; Webflo makes do with one from parent or ancestor.

#### Client-Side: Navigation Responses

On the client (the browser), every navigation event (page-to-page navigation, history back and forward navigation, and form submissions) initiates a request/response flow. The request object Webflo generates for these navigations is assigned an `Accept: application/json` header, so that data can be obtained as a JSON object. This request goes through the route's workflow (whether in the `/client`, `/worker`, or `/server` layer), and the JSON data obtained is simply sent into the already running HTML document as `document.state.page`. This makes it globally accessible to embedded scripts and rendering logic! (Details in [Rendering and Templating](#rendering-and-templating).)

### Rendering and Templating

As covered just above, routes that are intended to be accessed as a web page are expected to *first* be accessible as a JSON endpoint (returning an object). On the server, rendering happens *after* data is obtained from the workflow, but only when the browser explicitly asks for a `text/html` response! On the client, rendering happens *after* data is obtained from the workflow on each navigation event, but right into the same loaded document in the browser. In both cases, the concept of *templating* with HTML documents makes it possible to get pages to be as unique, or as generic, as needed on each navigation.

Every rendering and templating concept in Webflo is DOM-based - both with Client-Side Rendering and Server-Side Rendering (going by the default Webflo-native rendering). On the server, Webflo makes this so by making a DOM instance off of your `index.html` file. So, we get the same familiar `document` object and DOM elements everywhere! Webflo simply makes sure that the data obtained on each navigation is available as part of the `document` object - exposed at `document.state.page`.

You can access the `document` object (and its `document.state.page` property) both from a custom `render` callback and from a script that you can directly embed on the page.
+ **Case 1: From within a `render` callback**. If you defined a custom `render` callback on your route, you could call the `next()` function to advance the *render workflow* into Webflo's default rendering mode. The created `window` instance is returned.
  
  ```js
  /**
  server
   ├── index.js
   */
  export default async function(event, context, next) {
      return { title: 'Home | FluffyPets' };
  }
  export async function render(event, data, next) {
      let window = await next( data );
      let { document } = window;
      console.log( document.state.page ); // { title: 'Home | FluffyPets' }
      return window;
  }
  ```
  
+ **Case 2: From within an embedded script**. If you embedded a script on your HTML page, you would have access to the same `document.state.page` data.
  
  ```html
  <!--
  public
   ├── index.html
  -->
  <!DOCTYPE html>
  <html>
      <head>
          <title>FluffyPets</title>
          <script>
           setTimeout(() => {
               console.log( document.state.page ); // { title: 'Home | FluffyPets' }
           }, 0);
          </script>
      </head>
      <body></body>
  </html>
  ```
  
  But you could have that as an external resource - as in below. (But notice the `ssr` attribute on the `<script>` element. It tells Webflo to allow the script to be fetched and executed in a server-side context.)
  
  ```html
  <!--
  public
   ├── index.html
  -->
  <!DOCTYPE html>
  <html>
      <head>
          <title>FluffyPets</title>
          <script src="app.js" ssr></script>
      </head>
      <body></body>
  </html>
  ```

From here, even the most-rudimentary form of rendering and templating becomes possible (using vanilla HTML and native DOM methods), and this is a good thing: you get away with less tooling until you absolutely need to add up on tooling!

However, the `document` objects in Webflo can be a lot fun to work with: they support Object-Oriented HTML (OOHTML) natively, and this gives us a lot of (optional) syntatic sugar on top of vanilla HTML and the DOM!

> **Note**
> <br>You can learn more about OOHTML [here](https://github.com/webqit/oohtml).

> **Note**
> <br>You can disable OOHTML in config where you do not need to use its features in HTML and the DOM.

#### Rendering

Getting your application data `document.state.page` rendered into HTML can be a trival thing for applications that do not have much going on in the UI. Webflo allows your tooling budget to be as low as just using vanilla DOM APIs.

```html
 <!--
 public
  ├── index.html
 -->
 <!DOCTYPE html>
 <html>
     <head>
         <title>FluffyPets</title>
         <script>
          let app = document.state;
          setTimeout(() => {
              let titleElement = querySelector('title');
              let h1Element = querySelector('h1');
              titleElement.innerHTML = app.page.title;
              h1Element.innerHTML = app.page.title;
          }, 0);
         </script>
     </head>
     <body>
         <h1></h1>
     </body>
 </html>
```

> **Note**
> <br>We've used a *quick* `setTimeout()` strategy there to wait until the DOM is fully ready to be accessed; also, to wait for data to be available at `document.state.data`. In practice, the assumed delay of `0` may be too small. But, for when you can afford it, a better strategy is to actually *observe* for *[DOM readiness](https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event)* and *[data availability](#)*.

> **Note**
> <br>Considering the vanilla approach for your baisc UI? You probbably should! Low tooling budgets are a win in this case, and bare DOM manipulation are nothing to feel guilty of! (You may want to keep all of that JS in an external JS file to make your HTML tidy.)

