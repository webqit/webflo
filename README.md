# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@webqit/webflo" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@webqit/webflo.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@webqit/webflo" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@webqit/webflo.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a universal *web*, *mobile*, and *API backend* framework built to solve for the underrated `.html` + `.css` + `.js` stack! This has been crafted to keep your *tooling budget* low and your *application performance* high!

Webflo lets you build anything - from as basic as a static `index.html` page to as rich as a universal app capable of *MPA*, *SPA*, or hybrid routing, *SSG*, *SSR*, *CSR*, or hybrid rendering, offline and *PWA* capabilities, etc. - this time, without *loosing* the *vanilla* advantage!

Ok, we've put all of that up for a straight read! (Might turn out you already know Webflo! 😃)

> **Note**
> <br>Depending on your current framework background, the hardest part of Webflo might be having to break ties with something that isn't conventional to the `.html` + `.css` + `.js` stack: all of that JSX, CSS-in-JS, etc.!

## Documentation 

+ [Overview](#overview)
+ [Installation](#installation)
+ [Concepts](#concepts)

## Overview

<details>
 <summary><b>Build <i>scalable</i> anything</b> using a <i>Divide-and-Conquer Algorithm<a href="https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm"><small><sup>[i]</sup></small></a></i>! Webflo gives you a <i>workflow</i>-based design pattern for laying out your routes; and this is new!</summary>
<br>
 
Webflo lets you layout your application routes using *handler functions* as the building block, each defined in an `index.js` file.

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

Now, all of this gives you new way to break work down on each of your application routes!
</details>

<details>
<summary><b>Build <i>future-proof</i> anything</b> by banking more on the standards and less on abstractions! Webflo <i>just follows</i> where a native feature, standard, or conventional HTML, CSS or JS <i>just works</i>!</summary>
 <br>

All parts of a Webflo app speak the same language and seamlessly talk to each other and directly to the web platform itself!
 
For when your application involves routing:
+ [The Fetch Standard](https://fetch.spec.whatwg.org/) (across client, server, and Service Worker environments) - comprising of the [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request), [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response), and [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) interfaces - for all things *requests and responses*. ([Details ahead](#))

  > Your Request and Response objects are also able to *seamlessly exchange* - in addition to JSON - other standard objects like [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [File](https://developer.mozilla.org/en-US/docs/Web/API/File), and [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)

+ [WHATWG URL](https://url.spec.whatwg.org/) and [WHATWG URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) (across client, server, and Service Worker environments) for all things *URL* and *URL pattern matching*. ([Details ahead](#))

For when your application involves pages and a UI:
+ [The HTML Standard](https://html.spec.whatwg.org/) (across client, server, and Service Worker environments) for all things *markup* - conventional `.html`-based pages and templates, valid HTML syntax, etc. You go with a "zero-JavaScript" proposition or with *Progressive Enhancement* that makes do with "just-enough JavaScript"!

  > Your markup is also easily extendable with the [HTML Modules (`<template name="partials"></template>`)](https://github.com/webqit/oohtml#html-modules) and [HTML Imports (`<import template="partials"></import>`)](https://github.com/webqit/oohtml#html-imports) templating system, [Reactive Scripts (`<script type="subscript"></script>`)](https://github.com/webqit/oohtml#subscript), and whatever else is possible with HTML.

+ [WHATWG DOM](https://dom.spec.whatwg.org/) (across client and server environments) for all things *programmatic pages* - rendering, manipulation, interactivity, etc.

  > Your DOM is also easily enrichable with [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements), [Subscript Elements](https://github.com/webqit/oohtml#subscript), [The State API (`document.state` and `element.state`)](https://github.com/webqit/oohtml#state-api), and whatever else is possible with the DOM.

For when your application needs to give an app-like experience:
+ [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) (with full support for route handlers) - for offline and [Progressive Web Apps (PWA)](https://web.dev/progressive-web-apps/) capabilities.
  
  > You are also able to easily make your web app installable by complementing this with a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest).

This standards-based approach lets you work the way the web works now, and the way it'll work in the future!
</details>

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

Other important definitions like project `name`, package `type`, and *aliases* for common Webflo commands will now also belong here.

```json
{
  "name": "my-app",
  "type": "module",
  "scripts": {
    "start": "webflo start::server --mode=dev",
    "generate": "webflo generate::client --compress=gz --auto-embeds"
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

Whether building a *server-based*, *browser-based*, or *universal* application, Webflo gives us one consistent way to handle routing and navigation: using *handler functions*!

```js
/**
[server|client|worker]
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
> <br>The above function is built as part of your application's JS bundle on calling `npm run generate` on your terminal. (It is typically bundled to the file `./public/bundle.js`. And the `--auto-embeds` flag in that command gets this automatically embeded on your `./public/index.html` page as `<script type="module" src="/bundle.js"></script>`.) Then it responds from right in the browser on visiting http://localhost:3000.

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
> <br>The above function is built as part of your application's Service Worker JS bundle on calling `npm run generate` on your terminal. (It is typically bundled to the file `./public/worker.js`, and the main application bundle automatically connects to it.) Then it responds from within the Service Worker on visiting http://localhost:3000.

So, depending on what's being built, an application's handler functions may take the following form (in part or in whole as with universal applications):

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

But, where workflows return `undefined`, a `404` HTTP response is returned. In the case of client-side workflows - in `/client`, the already running HTML page in the browser receives empty data, and, at the same time, set to an error state. (Details in [Rendering and Templating](#rendering-and-templating).)

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

+ **Case 2: Automatically-paired HTML files**. These are valid HTML documents named `index.html` in the `/public` directory, or a subdirectory that corresponds with a route.
   
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
+ **Case 1: From within a `render` callback**. If you defined a custom `render` callback on your route, you could call the `next()` function to advance the *render workflow* into Webflo's default rendering mode. A `window` instance is returned containing the implied document.
  
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
  
+ **Case 2: From within an embedded script**. If you embedded a script on your HTML page, you could access the `document.state.page` data as you'd expected.
  
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
  
  But you could have that as an external resource - as in below. (But notice the `ssr` attribute on the `<script>` element. It allows the rendering engine to fetch and execute the script in this server-side context.)
  
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

However, the `document` objects in Webflo can be a lot fun to work with: they support Object-Oriented HTML (OOHTML) natively, and this gives us a lot of (optional) syntax sugars on top of vanilla HTML and the DOM!

> **Note**
> <br>You can learn more about OOHTML [here](https://github.com/webqit/oohtml).

> **Note**
> <br>You can disable OOHTML (or some of its features) in config where you do not need to use its features in HTML and the DOM.

#### Rendering

Getting your application data `document.state.page` rendered into HTML can be a trival thing for applications that do not have much going on in the UI. Webflo allows your tooling budget to be as low as just using vanilla DOM APIs!

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
> <br>If you're considering the vanilla approach for your baisc UI, you probbably should! Low tooling budgets are a win in this case, and bare DOM manipulations are nothing to feel guilty of! (You may want to keep all of that JS in an external JS file to make your HTML tidy.)

Where your application UI is more than basic, you would benefit from using OOHTML features in HTML and on the DOM! (Documents created by Webflo are OOHTML-ready by default.) Here, you are able to write reactive UI logic, namespace-based HTML, HTML modules and imports, etc - without the usual framework thinking.

To write **reactive UI logic**, OOHTML makes it possible to define `<script>` elements right along with your HTML elements - where you get to write as much or as little JavaScript as needed for a behaviour!

```html
 <!--
 public
  ├── index.html
 -->
 <!DOCTYPE html>
 <html>
     <head>
         <title>FluffyPets</title>
         <script type="subscript">
          let app = document.state;
          let titleElement = this.querySelector('title');
          titleElement.innerHTML = app.page.title;
         </script>
     </head>
     <body>
         <h1></h1>
         <script type="subscript">
          let app = document.state;
          let h1Element = this.querySelector('h1');
          h1Element.innerHTML = app.page.title;
         </script>
     </body>
 </html>
```

> **Note**
> <br>You'll find it logical that UI logic is the whole essence of the HTML `<script>` element, after all! OOHTML just extends the regular `<script>` element with the `subscript` type to give them *reactivity* and keep them scoped to their host element! (You can learn more [here](https://github.com/webqit/oohtml#subscript).)

From here, you can go on to use any DOM manipulation library of your choice; e.g jQuery, or even better, the jQuery-like [Play UI](https://github.com/webqit/play-ui) library.

```html
 <!--
 public
  ├── index.html
 -->
 <!DOCTYPE html>
 <html>
     <head>
         <title>FluffyPets</title>
         <script type="subscript">
          let app = document.state;
          $('title').html(app.page.title);
         </script>
     </head>
     <body>
         <h1></h1>
         <script type="subscript">
          let app = document.state;
          $('h1').html(app.page.title);
         </script>
     </body>
 </html>
```

You'll find many other OOHTML features that let you write the most enjoyable HTML. And when you need to write class-based components, you'll fall in love with [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)!

#### Templating

