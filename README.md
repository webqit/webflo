# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@webqit/webflo" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@webqit/webflo.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@webqit/webflo" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@webqit/webflo.svg" alt="NPM downloads" /></a></span>

<!-- /BADGES -->

Webflo is a universal *web*, *mobile*, and *API backend* framework built to solve for the underrated `.html` + `.css` + `.js` stack! This has been written on a clean slate to draw directly on all of HTML, CSS and JavaScript - and in essence, starve your *tooling budget* to feed your *developer experience* and *application performance*! 🔥

Webflo lets you build anything - from as basic as a static `index.html` page to as rich as a universal app that's either a *[Multi Page Application (MPA)](#in-a-multi-page-architecture)*, *[Single Page Application (SPA)](#in-a-single-page-architecture)*, or a hybrid of these, capable of *Server Side Generation (SSG)*, *[Server Side Rendering (SSR)](#rendering-and-templating)*, *[Client Side Rendering (CSR)](#rendering-and-templating)*, or a hybrid of these, offline and *PWA* capabilities, etc. - this time, without *loosing* the *vanilla* advantage!

Ok, we've put all of that up for a straight read!

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

They form a step-based workflow for your routes, with each step *owning* the next...

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

This way, you are able to break work down on each of your application routes!
</details>

<details>
<summary><b>Build <i>future-proof</i> anything</b> by banking more on web standards and less on abstractions! Webflo <i>just follows</i> where a native feature, standard, or conventional HTML, CSS or JS <i>just works</i>!</summary>
 <br>

Here's a glimpse of the standards-based stack you get of Webflo!
 
For when your application involves routing:
+ [The Fetch Standard](https://fetch.spec.whatwg.org/), comprising of the [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request), [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response), and [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) interfaces, is used for all things *requests and responses* - across client, server, and Service Worker environments. ([Details ahead](#requests-and-responses))

  > This paves the way to using other native APIs as-is, when handling requests and responses. For example, your Request and Response objects are able to *seamlessly exchange* - in addition to JSON - instances of the native [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [File](https://developer.mozilla.org/en-US/docs/Web/API/File), and [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) objects!

+ [WHATWG URL](https://url.spec.whatwg.org/) and [WHATWG URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) are used for all things *URL* and *URL pattern matching*, respectively - across client, server, and Service Worker environments. ([Details ahead](#))

For when your application involves pages and a UI:
+ [The HTML Standard](https://html.spec.whatwg.org/) is held for all things *markup* - across client, server, and Service Worker environments! Webflo is all about using conventional `.html`-based pages and templates, valid HTML syntax, etc. You are able go with a "zero-JavaScript" proposition or with *Progressive Enhancement* that makes do with "just-enough JavaScript"!

  > Your markup is also easily extendable with [OOHTML](https://github.com/webqit/oohtml) - a set of new features that make it fun to author HTML documents: [HTML Modules (`<template name="partials"></template>`)](https://github.com/webqit/oohtml#html-modules) and [HTML Imports (`<import template="partials"></import>`)](https://github.com/webqit/oohtml#html-imports), [Reactive Scripts (`<script type="subscript"></script>`)](https://github.com/webqit/oohtml#subscript) and more!

+ [WHATWG DOM](https://dom.spec.whatwg.org/) is universally available - across client and server environments - for all things *dynamic UIs*: rendering, manipulation, interactivity, etc.

  > Your DOM is also easily enrichable with [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements), plus [Subscript Elements](https://github.com/webqit/oohtml#subscript) and [The State API (`document.state` and `element.state`)](https://github.com/webqit/oohtml#state-api) from OOHTML.

For when your application needs to give an app-like experience:
+ [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), extended with full support for routing, come into play for offline and [Progressive Web Apps (PWA)](https://web.dev/progressive-web-apps/) capabilities.
  
  > You are also able to easily make your web app installable by complementing this with a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest).
 
This and more - ahead! For building web-native apps!
</details>

## Installation

Every Webflo project starts on an empty directory that you can create on your machine. The command below will make a new directory `my-app` from the terminal and navigate into it.

```shell
mkdir my-app
cd my-app
```

With [npm available on your terminal](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), run the following command to install Webflo to your project:

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
    "generate": "webflo generate::client --compression=gz --auto-embed"
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

Each function receives an `event` object representing the current flow. (But details ahead.)

For *server-based* applications (e.g. traditional web apps and API backends), server-side handlers go into a directory named `server`.

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
> <br>The above function responds on starting the server - `npm start` on your terminal - and visiting http://localhost:3000.

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
> <br>The above function is built as part of your application's JS bundle on calling `npm run generate` on your terminal. (It is typically bundled to the file `./public/bundle.js`. And the `--auto-embed` flag in that command gets this automatically embedded on your `./public/index.html` page as `<script type="module" src="/bundle.js"></script>`.) Then it responds from right in the browser on visiting http://localhost:3000.

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

Whether routing in the `/client`, `/worker`, or `/server` directory above, nested URLs follow the concept of Step Functions! As seen earlier, these are parent-child layout of handlers that model an URL strucuture.

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

For workflows in **the `/server` directory**, the *default action* of `next()`ing at the edge is to go match and return a static file in the `public` directory.

So, above, should our handler receive static file requests like `http://localhost:3000/logo.png`, the expression `return next()` would get Webflo to match and return the logo at `public/logo.png`, if any; a `404` response otherwise.

```shell
my-app
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/prodcuts, http://localhost:3000/prodcuts/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>The root handler effectively becomes the single point of entry to the application - being that it sees even static requests!

Now, for workflows in **the `/worker` directory**, the *default action* of `next()`ing at the edge is to send the request through the network to the server. (But Webflo will know to attempt resolving the request from the application's caching system built into the Service Worker.)

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
> <br>Handlers in the `/worker` directory are only designed to see Same-Origin requests since Cross-Origin URLs like `https://auth.example.com/oauth` do not belong in the application's layout! These external URLs, however, benefit from the application's caching system built into the Service Worker.

For workflows in **the `/client` directory**, the *default action*  of `next()`ing at the edge is to send the request through the network to the server. But where there is a Service Worker layer, then that becomes the next destination.

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

But, where workflows return `undefined`, a `404` HTTP response is returned. In the case of client-side workflows - in `/client`, the already running HTML page in the browser receives empty data, and is, at the same time, set to an error state. (Details in [Rendering and Templating](#rendering-and-templating).)

#### Server-Side: API and Page Responses

On the server, jsonfyable responses effectively become a *JSON API response*! (So, we get an API backend this way by default.)

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

On the client (the browser), every navigation event (page-to-page navigation, history back and forward navigation, and form submissions) initiates a request/response flow. The request object Webflo generates for these navigations is assigned an `Accept: application/json` header, so that data can be obtained as a JSON object. This request gets handled by route handlers, and the JSON data obtained is simply sent into the already running HTML document as `document.state.page`. This makes it globally accessible to embedded scripts and rendering logic! (Details in [Rendering and Templating](#rendering-and-templating).)

### Rendering and Templating

As covered just above, routes that are intended to be accessed as a web page are expected to *first* be accessible as a JSON endpoint (returning an object). On the server, rendering happens *after* data is obtained from the workflow, but only when the browser explicitly asks for a `text/html` response! On the client, rendering happens *after* data is obtained from the workflow on each navigation event, but right into the same loaded document in the browser. In both cases, the concept of *templating* with HTML documents makes it possible to get pages to be as unique, or as generic, as needed on each navigation.

Every rendering and templating concept in Webflo is DOM-based. On the server, Webflo makes this so by making a DOM instance off of your `index.html` file - using the [OOHTML SSR](https://github.com/webqit/oohtml-ssr) library. So, we get the same familiar `document` object and DOM elements everywhere! Webflo simply makes sure that the data obtained on each navigation is available as part of the `document` object - exposed at `document.state.page`.

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
  
  Where your rendering logic is an external script, your `<script>` element would need to have an `ssr` Boolean attribute to get the rendering engine to fetch and execute your script on the server.
  
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

To write **reactive UI logic**, OOHTML makes it possible to define `<script>` elements right along with your HTML elements - where you get to do all things logic in the language for logic - JavaScript!

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
> <br>You'll find it logical that UI logic is the whole essence of the HTML `<script>` element, after all! OOHTML just extends the regular `<script>` element with the `subscript` type to give them *reactivity* and keep them scoped to their host element! (You can learn more [here](https://github.com/webqit/oohtml#subscript).) Note, too, that these reactive script elements do not require any `setTimeout()` construct as the earlier classic `<script>` had.

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

You'll find many other OOHTML features that let you write the most enjoyable HTML. And when you need to write class-based components, you'll find a friend in [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)!

#### Templating

In a Multi Page Application (MPA), each navigation lands in a new `index.html` page, and it is often necessary to have parts of the UI - e.g. site header, footer, and sidebar, etc. - *persist* across these *multiple* pages.

```html
my-app
  └── public
      ├── about/index.html ------------------------- <!DOCTYPE html>
      ├── prodcuts/index.html ---------------------- <!DOCTYPE html>
      ├── index.html ------------------------------- <!DOCTYPE html>
      ├── header.html ------------------------------ <header></header> <!-- To appear at top of each index.html page -->
      └── footer.html ------------------------------ <footer></footer> <!-- To appear at bottom of each index.html page -->
```

In a Single Page Application (SPA), each navigation lands in the same `index.html`, and it is often necessary to have parts of this *single* page - e.g. main content area, etc. - dynamically *change* based on the URL.

```html
my-app
  └── public
      ├── index.html ------------------------------- <!DOCTYPE html>
      ├── about/main.html -------------------------- <main></main> <!-- To appear at main area of index.html -->
      ├── prodcuts/main.html ----------------------- <main></main> <!-- To appear at main area of index.html -->
      └── main.html -------------------------------- <main></main> <!-- To appear at main area of index.html -->
```

This, in both cases, is templating - the ability to define HTML *partials* once, and have them reused multiple times. Webflo just concerns itself with templating, and the choice of a Multi Page Application or Single Page Application becomes yours! And heck, you can even have the best of both worlds in the same application! It's all *templating*!

Templating in Webflo is based on the [HTML Modules](https://github.com/webqit/oohtml#html-modules) and [HTML Imports](https://github.com/webqit/oohtml#html-imports) features of [OOHTML](https://github.com/webqit/oohtml), which is, itself, based on the [HTML `<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) element. Here, you are able to define reusable contents in a `<template>` element...

```html
<head>
    <template name="page">
        <header exportgroup="header.html">Header Area</header>
        <main exportgroup="main.html">Main Area</main>
    </template>
</head>
```

...and have them imported anywhere with an `<import>` element:

```html
<body>
    <import template="page" name="header.html"></import>
    <import template="page" name="main.html"></import>
</body>
```

This *module*, *export* and *import* paradigm comes full-fledged for every templating need! For example, the *module* element - `<template name>` - is able to load its contents from a remote `.html` file that serves as a bundle:

```html
<!--
public
 ├── bundle.html
-->
<header exportgroup="header.html">Header Area</header>
<main exportgroup="main.html">Main Area</main>
```

```html
<head>
    <template name="page" src="/bundle.html"></template>
</head>
```

What [we'll see shortly](#bundling) is how multiple standalone `.html` files - e.g. the `header.html`, `footer.html`, `main.html` files above - come together into one `bundle.html` file for an application.

##### In a Multi Page Architecture

In a Multi Page layout, generic contents - e.g. header and footer sections, etc. - are typically bundled and reused across each page of an application.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="page" src="/bundle.html"></template>
    </head>
    <body>
        <import template="page" name="header.html"></import>
        <main>Welcome to our Home Page</main>
        <import template="page" name="footer.html"></import>
    </body>
</html>
```

```html
<!--
public/about
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="page" src="/bundle.html"></template>
    </head>
    <body>
        <import template="page" name="header.html"></import>
        <main>Welcome to our About Page</main>
        <import template="page" name="footer.html"></import>
    </body>
</html>
```

```html
<!--
public/products
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="page" src="/bundle.html"></template>
    </head>
    <body>
        <import template="page" name="header.html"></import>
        <main>Welcome to our Products Page</main>
        <import template="page" name="footer.html"></import>
    </body>
</html>
```

> **Note**
> <br>In this architecture, navigation is traditional - a new page loads each time. The `bundle.js` script comes with the appropriate OOHTML support level required for the imports to function.

##### In a Single Page Architecture

In a Single Page layout, page-specific contents - e.g. main sections - are typically bundled together as nested `<template>` elements in a way that models their URL structure.

```html
<!--
public
 ├── bundle.html
-->
<template name="about">
    <main exportgroup="main.html">Welcome to our About Page</main>
</template>
<template name="products">
    <main exportgroup="main.html">Welcome to our Products Page</main>
</template>
<main exportgroup="main.html">Welcome to our Home Page</main>
```

And the appropriate `<main>` element is imported based on the URL path. This time, Webflo takes care of setting the URL path as a global `template` attribute on the `<body>` element such that `<import>` elements that inherit this global attribute are resolved on each page navigation.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="page" src="/bundle.html"></template>
    </head>
    <body template="page/"> <!-- This template attribute automatically changes to page/about or page/products as we navigate to http://localhost:3000/about and http://localhost:3000/products respectively -->
        <header></header>
        <import name="main.html"></import> <!-- This import element omits a template attribute so as to inherit the global one -->
        <footer></footer>
    </body>
</html>
```

> **Note**
> <br>In this architecture, navigation is instant and sleek - Webflo prevents a page reload, obtains and sets data at `document.state.page` for the new URL, then set the URL path as a global `template` attribute on the `<body>` element. The `bundle.js` script comes with the appropriate OOHTML support level required for the imports to function.

##### In a Hybrid Architecture

It's all *templating*, so a hybrid of the two architectures above is possible in one application, to take advantage of the unique benefits of each! Here, subroutes are defined either as a standalone page - of `index.html` - or as the `main.html` (or similar) part of a base `index.html` page.

```html
my-app
  └── public
      ├── about/index.html ------------------------- <!DOCTYPE html>
      ├── prodcuts
      │     ├── index.html ------------------------------- <!DOCTYPE html>
      │     ├── free/main.html --------------------------- <main></main> <!-- To appear at main area of index.html -->
      │     ├── paid/main.html --------------------------- <main></main> <!-- To appear at main area of index.html -->
      │     └── main.html -------------------------------- <main></main> <!-- To appear at main area of index.html -->
      ├── index.html ------------------------------- <!DOCTYPE html>
      ├── header.html ------------------------------ <header></header> <!-- To appear at top of each index.html page -->
      └── footer.html ------------------------------ <footer></footer> <!-- To appear at bottom of each index.html page -->
```

The above gives us three document roots: `/index.html`, `/about/index.html`, `/prodcuts/index.html`. The `/prodcuts` route is to function as a Single Page Application such that visiting the `/prodcuts` route loads the document root `/prodcuts/index.html` and lets the client-side *navigation + templating system* determine which of `/prodcuts/main.html`, `/prodcuts/free/main.html`, `/prodcuts/paid/main.html` is resolved based on the application URL path.

Webflo ensures that only the amount of JavaScript for a document root is actually loaded! So, above, a common JavaScript build is shared across the three document roots alongside an often tiny root-specific build.

```html
<!--
public
 ├── products/index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="webflo.bundle.js"></script>
        <script type="module" src="/products/bundle.js"></script>
        <template name="pages" src="/bundle.html"></template>
    </head>
    <body>...</body>
</html>
```

```html
<!--
public
 ├── about/index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="webflo.bundle.js"></script>
        <script type="module" src="/about/bundle.js"></script>
        <template name="pages" src="/bundle.html"></template>
    </head>
    <body>...</body>
</html>
```

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="webflo.bundle.js"></script>
        <script type="module" src="/bundle.js"></script>
        <template name="pages" src="/bundle.html"></template>
    </head>
    <body>...</body>
</html>
```

> **Note**
> <br>The Webflo `generate` command automatically figures out a given architecture and generates the appropriate scripts for the application! It also factors in the location of each document root so that all navigations to these roots are handled as a regular page load.

##### Bundling

Template `.html` files are bundled from the filesystem into a single file using the [OOHTML CLI](https://github.com/webqit/oohtml-cli) utility. On installing this utility, you may want to add the following scripts to your `package.json`.

```json
"generate:html": "oohtml bundle --recursive --auto-embed=page"
```

The `--recursive` flag gets the bundler to recursively bundle *subroots* in a hybrid architecture - subdirectories with their own `index.html` document. (Subroots are ignored by default.)

The `--auto-embed` flag gets the bundler to automatically embed the generated `bundle.html` file on the matched `index.html` document. A value of `page` for the flag ends up as the name of the *embed* template: `<template name="page" src="/bundle"></template>`.

> **Note**
> <br>If your HTML files are actually based off the `public` directory, you'll need to tell the above command to run in the `public` directory either by configuring the bundler via `oohtml config bundler` or by rewriting the command with a prefix: `cd public && oohtml bundle --recursive --auto-embed=page`. 
