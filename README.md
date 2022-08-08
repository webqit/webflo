# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@webqit/webflo" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@webqit/webflo.svg" alt="NPM version" /></a></span>

<!-- /BADGES -->

Webflo is a universal *web*, *mobile*, and *API backend* framework based on vanilla HTML, CSS, and JavaScript! It's a powerful little thing written to facilitate building more authentic, web-native applications!

Here, we've put all of that up for a 20mins straight read!

## Heads Up...

Webflo is a framework on its own track - of working and thinking in vanilla HTML, CSS and JavaScript! Instead of trying to follow certain patterns that have been touted as "norms", it takes a plunge to draw on native web platform features - plus some more futurisric, fascinating new stuff from across a few web paltforn proposals! This means that to happily meet Webflo, you also have to be excited about the idea of going one step ahead!

**Note** that Webflo is still evolving and some things may change quickly! Careful with *production*! Or, just remember to keep tabs with progress here!

## The Wins...

Much of what eludes the web today!

Introducing...

+ the path of least engineering - with an all-new HTML-first thinking!
+ a focused, standards-based philosophy for building more authentic, web-native applications!

Natively supporting notable new possibilities...

+ a new approach to reactivity that's based on no syntax at all but plain old JavaScript!
+ a new "imports" feature for HTML that makes HTML more reusable!
+ and much more.

## Documentation

(A bit of a long read!)

+ [Overview](#overview)
+ [Installation](#installation)
+ [Concepts](#concepts)
  + [Handler Functions and Layout](#handler-functions-and-layout)
  + [Step Functions and Workflows](#step-functions-and-workflows)
  + [Pages, Layout and Templating](#pages-layout-and-templating)
  + [Client and Server-Side Rendering](#client-and-server-side-rendering)
  + [Requests and Responses](#requests-and-responses)
+ [Webflo Applications](#webflo-applications)
  + [Client-Side Applications](#client-side-applications)
  + [Progressive Web Apps](#progressive-web-apps)
  + [API Backends](#api-backends)
  + [Static Sites](#static-sites)
+ [Webflo Config](#webflo-config)
+ [Webflo Tooling](#webflo-tooling)
  + [OOHTML](#oohtml)
  + [OOHTML SSR](#oohtml-ssr)
  + [OOHTML CLI](#oohtml-cli)
  + [The Observer API](#the-observer-api)
+ [Getting Started](#getting-started)
+ [Getting Involved](#getting-involved)

## Overview

<details>
 <summary><b>Build <i>anything</i></b> - from as basic as a static <code>index.html</code> page to as rich as a <i>Multi Page Application (MPA)</i>, or <i>Single Page Application (SPA)</i>, or a hybrid of both, implementing <i>Server Side Rendering (SSR)</i>, <i>Client Side Rendering (CSR)</i>, or a hybrid of both, having offline and <i>PWA</i> capabilities, etc. - this time, <i>without loosing the vanilla advantage</i>!
</summary>
 
Here's a glimpse of your Webflo app.

For when your application is a static site, or has static files to serve:
+ The `public` directory for static files.

  ```shell
  my-app
    ├── public/index.html ----------------- http://localhost:3000/index.html | http://localhost:3000
    └── public/logo.png ------------------- http://localhost:3000/logo.png
  ```

For when your application requires dynamic request handling on the server:
+ The `server` directory for server-side routing.

  ```shell
  my-app
    └── server/index.js
  ```
  
  In which case a typical `index.js` route handler has the following anatomy:

  ```js
  /**
  server
   ├── index.js
   */
  export default function(event, context, next) {
      if (next.pathname) {
          return next();  // <--------------------------------- http://localhost:3000/logo.png (or other non-root URLs)
      }
      return { title: 'Hello from Server' };  // <------------- http://localhost:3000/ (root URL)
  }
  ```
 
  In which case data is returned either as a JSON (API) response, or as a rendered page response where there is an `index.html` file in the `public` directory that pairs with the route.

  ```shell
  my-app
    ├── server/index.js
    └── public/index.html
  ```
  
  In which case a typical `index.html` page has the following anatomy:
  
  ```html
  <!--
  public
    ├── index.html
  -->
  <!DOCTYPE html>
  <html>
      <head>
          <link rel="stylesheet" href="/style.css" />   <!-- ---------------------- Application CSS -->
          <script type="module" src="/bundle.js"></script>   <!-- ----------------- Application JS bundle -->
          <template name="routes" src="/bundle.html"></template>   <!-- ------------- Reusable HTML Templates and partials (Details ahead) -->
      </head>
      <body>...</body>
  </html>
  ```

For when your application requires dynamic request handling on the client (the browser):
+ The `client` directory for client-side routing,
+ And, optionally, the `worker` directory for an all-new Service Worker based routing! (As detailed ahead.)

  ```shell
  my-app
    ├── client/index.js
    └── worker/index.js
  ```
  
  Where in both cases, a typical `index.js` route handler has the same familiar anatomy:

  ```js
  /**
  [client|worker]
   ├── index.js
   */
  export default function(event, context, next) {
      if (next.pathname) {
          return next();  // <--------------------------------- http://localhost:3000/logo.png (or other non-root URLs)
      }
      return { title: 'Hello from [Browser|Worker]' };  // <--- http://localhost:3000/ (root URL)
  }
  ```
 
This and much more - ahead!
</details>

<details>
<summary><b>Build <i>future-proof anything</i></b> by banking more on web standards and less on abstractions! Webflo <i>just follows</i> where a native feature, standard, or conventional HTML, CSS or JS <i>already works</i>!</summary>

Here's a glimpse of the standards-based stack you get of Webflo!
 
For when your application involves routing:
+ [The Fetch Standard](https://fetch.spec.whatwg.org/), comprising of the [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request), [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response), and [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) interfaces, is used for all things *requests and responses* - across client, server, and Service Worker environments. ([Details ahead](#requests-and-responses))

  > This paves the way to using other native APIs as-is, when handling requests and responses. For example, if you sent an instance of the native [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [File](https://developer.mozilla.org/en-US/docs/Web/API/File), or [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) object from the browser side of your application, you'd be getting the equivalent instance on the server side!

+ [WHATWG URL](https://url.spec.whatwg.org/) and [WHATWG URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) are used for all things *URL* and *URL pattern matching*, respectively - across client, server, and Service Worker environments. ([Details ahead](#))

For when your application involves pages and a UI:
+ [The HTML Standard](https://html.spec.whatwg.org/) is held for all things *markup* - across client, server, and Service Worker environments! Webflo is all about using conventional `.html`-based pages and templates, valid HTML syntax, etc.

  > This HTML-first approach is new! And you can get away with a "zero-JavaScript" proposition, or something more of a *Progressive Enhancement* proposition that makes do with "just-enough JavaScript"!

+ [WHATWG DOM](https://dom.spec.whatwg.org/) is universally available - not only on the client-side, but also on the server-side via [OOHTML-SSR](#oohtml-ssr) - all of which lets us have *dynamic pages*.

  > And you get to have [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) as powerful building blocks.
 
This and more - ahead! For building web-native apps!
</details>

## Installation

Every Webflo project starts on an empty directory that you can create on your machine. The command below makes a new directory `my-app` from the terminal and navigates into it.

```shell
mkdir my-app
cd my-app
```

With [npm available on your terminal](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), run the following command to install Webflo to your project:

> System Requirements: Node.js 14.0 or later

```shell
npm i @webqit/webflo
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

And that gets it all ready! The commands `npm start` and `npm run generate` will be coming in often during development.

### "Hello World!"

To be sure that Webflo is listening, run `npx webflo help` on the terminal. An overview of available commands should be shown.

If you can't wait to say *Hello World!* 😅, you can have an HTML page say that right away!
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
  npm start
  ```
+ Welcome to Webflo!

## Concepts

+ [Handler Functions and Layout](#handler-functions-and-layout)
+ [Step Functions and Workflows](#step-functions-and-workflows)
+ [Pages, Layout and Templating](#pages-layout-and-templating)
+ [Client and Server-Side Rendering](#client-and-server-side-rendering)
+ [Requests and Responses](#requests-and-responses)

### Handler Functions and Layout

Functions come in in Webflo when you need to dynamically handle requests.

Whether building a *server-based*, *browser-based*, or *universal* application, Webflo gives you one consistent way to handle requests and navigation: using *handler functions*!

You just define an `index.js` file with a function that gets called to handle a request!

```js
/**
[server|client|worker]
 ├── index.js
 */
export default function(event, context, next, fetch) {
}
```

<details>
<summary>Functions may have a name...</summary>

```js
export function GET(event, context, next, fetch) {
}
```

> Function names take after [*HTTP method*](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods): `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`, etc. (Function names are lower case for Webflo version <= `0.11.23`, in which case `delete` is `del`.)
</details>

<details>
<summary>Functions may may be <code>async</code>...</summary>

```js
export async function GET(event, context, next, fetch) {
    let a = await b();
}
```
</details>

Each function receives an `event` object representing details about the request - e.g. `event.request`, `event.url`, `event.session`. ([Details ahead](#workflow-api).)

While the `context` and `next` parameters are discussed below, `fetch` is a [fetch](https://fetch.spec.whatwg.org/)-equivalent function passed in for *convenience* - for initiating remote requests.

**Functions that will respond to requests on the server-side** go into a directory named `server`.

```js
/**
server
 ├── index.js
 */
export default function(event, context, next) {
    if (next.pathname) return next();
    return {
        title: 'Home | FluffyPets',
        source: 'server',
    };
}
```

<details>
<summary>How it works...</summary>

> The above function will respond on starting the server - `npm start` on your terminal - and visiting http://localhost:3000.
</details>

**Funtions that will respond to requests on the client-side (from right within the browser)** go into a directory named `client`.

```js
/**
client
 ├── index.js
 */
export default function(event, context, next) {
    if (next.pathname) return next();
    return {
        title: 'Home | FluffyPets',
        source: 'in-browser',
    };
}
```

<details>
<summary>How it works...</summary>

> The above function is built as part of your application's client-side script from the `npm run generate` command. It is typically bundled to the file `./public/bundle.js`. And the `--auto-embed` flag in that command gets it automatically embedded on your `./public/index.html` page as `<script type="module" src="/bundle.js"></script>`. Then it responds from right in the browser on visiting http://localhost:3000.
</details>

For *browser-based* applications that want to employ Service-Workers (typically, Progressive Web Apps), Webflo allows for equivalent request handlers as part of the Service Worker. These **worker-based** functions go into a directory named `worker`.

```js
/**
worker
 ├── index.js
 */
export default function(event, context, next) {
    if (next.pathname) return next();
    return {
        title: 'Home | FluffyPets',
        source: 'service-worker',
    };
}
```

<details>
<summary>How it works...</summary>

> The above function is built as part of your application's Service Worker script from the `npm run generate` command. It is typically bundled to the file `./public/worker.js`, and the main application bundle automatically registers this as the application's Service Worker. Now, our function responds from within the Service Worker on visiting http://localhost:3000. (More details [ahead](#service-workers).)
</details>

So, depending on where requests are best handled for your type of application, handler functions may be placed as below:

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
  └── logo.png
```

### Step Functions and Workflows

Whether routing in the `/client`, `/worker`, or `/server` directory above, nested URLs follow the concept of Step Functions! These are parent-child layout of handlers that model your application's URL structure.

```shell
server
  ├── index.js --------------------------------- http://localhost:3000
  └── products/index.js ------------------------ http://localhost:3000/products
        └── stickers/index.js ------------------ http://localhost:3000/products/stickers
```

Each step calls a `next()` function to forward the current request to the next step.

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    if (next.stepname) return next();
    return { title: 'Home | FluffyPets' };
}
```

```js
/**
server
 ├── products/index.js
 */
export default function(event, context, next) {
    if (next.stepname) return next();
    return { title: 'Products' };
}
```

We get a step-based workflow that helps to decomplicate routing and lets us scale horizontally as our application grows larger.

<details>
<summary>Each step can entirely control the next...</summary>

Here, a parent step can pass a `context` object to a child step, and can *recompose* its return value.

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    if (next.stepname) {
        let childContext = { user: { id: 2 }, };
        let childResponse = await next(childContext);
        return { ...childResponse, title: childResponse.title + ' | FluffyPets' };
    }
    return { title: 'Home | FluffyPets' };
}
```

<details>
<summary>But a function can just talk to any other function...</summary>

It's versatile, so the `next()` function can be used to re-route the current request to a different handler - using a relative or absolute URL.

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    if (next.stepname === 'products') {
        return next(context, '/api/products?params=allowed'); // With an absolute URL
    }
    return { title: 'Home | FluffyPets' };
}
```

```js
/**
server
 ├── products/index.js
 */
export default async function(event, context, next) {
    if (next.stepname) return next();
    return next(context, '../api/products?params=allowed'); // With a relative URL
}
```

And you can make that a full-fledged *in-app* request - passing in `fetch`-equivalent parameters.

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    if (next.stepname === 'products') {
        return next(context, '/api/products?params=allowed', {
            method: 'get', { headers: { Authorization: 'djjdd' } } 
        });
    }
    return { title: 'Home | FluffyPets' };
}
```

These requests are received at destination route - `/api/products` above - as regular HTTP requests!
</details>
</details>

For even more flexibility, workflows may be designed with *wildcard* steps using a hyphen `-` as step name. At runtime, a wildcard step matches any URL segment at its level in the hierarchy! A `this.stepname` property is always available to tell which URL segment has been matched.

```js
/**
server
 ├── -/index.js
 */
export default function(event, context, next) {
    if (this.stepname === 'products') {
        return { title: 'Products' };
    }
    return { title: 'Untitled' };
}
```

<details>
<summary>More details...</summary>

> Every handler function has the following contextual properties:
> + `this.stepname` - The name of the current step.
> + `this.pathname` - The URL pathname of the current step.
> + `next.stepname` - The name of the next step.
> + `next.pathname` - The remaining URL pathname after the current step.
> Server-side handlers have the following in addition:
> + `this.dirname` - The filesystem pathname of the current step.
</details>

Additionally, workflows may be designed with as many or as few step functions as necessary; the flow control parameters `next.stepname` and `next.pathname` are always available at any point to help with the remaining part of an URL.

This means that it is even possible to handle all URLs from the root handler alone.

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

The `next()` function still comes in above because Webflo takes a *default action* when `next()` is called at the *edge* of the workflow - this point where there are no more step functions as there are URL segments.

**For workflows in the `/server` directory**, the *default action* of `next()`ing at the edge is to go match and return a static file in the `public` directory.

So, above, should our handler receive static file requests like `http://localhost:3000/logo.png`, the statement `return next()` would get Webflo to match and return the logo at `public/logo.png`, if any; a `404` response otherwise.

```shell
my-app
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/products, http://localhost:3000/products/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

> **Note**
> <br>Obviously, the root handler effectively becomes the single point of entry to the application - being that it sees even requests for static files!

**For workflows in the `/worker` directory**, the *default action* of `next()`ing at the edge is to send the request through the network to the server. (But Webflo will check to see whether to (and how to) resolve the request from the application cache.)

So, above, if we defined handler functions in the `/worker` directory, we could selectively handle specific requests while `next()`ing others to the server.

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

Now we get the following handler-to-URL mapping for our application:

```shell
my-app
  ├── worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/products, http://localhost:3000/products/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

<details>
<summary>More details...</summary>

> Handlers in the `/worker` directory see only Same-Origin requests, being that Cross-Origin URLs like `https://auth.example.com/oauth` do not belong in the application's layout! But as detailed later, these external URLs may be may configured for strategic caching by the Service Worker.
</details>

**For workflows in the `/client` directory**, the *default action*  of `next()`ing at the edge is to send the request through the network to the server. But where there is a Service Worker layer, then that becomes the next destination.

So, above, if we defined handler functions in the `/client` directory, we could selectively handle specific navigation requests in-browser while `next()`ing others down to the server, or first, the Service Worker layer.

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

Our overall handler-to-URL mapping for the hypothetical application in context now becomes:

```shell
my-app
  ├── client/index.js ------------------------- http://localhost:3000/login
  ├── worker/index.js ------------------------- http://localhost:3000/about, http://localhost:3000/logo.png
  ├── server/index.js ------------------------- http://localhost:3000, http://localhost:3000/products, http://localhost:3000/products/stickers, etc
  └── public/logo.png ------------------------- http://localhost:3000/logo.png
```

If there's anything we have now, it is the ability to break work down<a href="https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm"><small><sup>[i]</sup></small></a>, optionally across step functions, optionally between layers! 

### Pages, Layout and Templating

HTML files in the `public` directory, just like every other *public* file, are served statically when accessed directly - e.g. `http://localhost:3000/index.html`. But `index.html` files, specifically, are treated as *pages* by Webflo. They are, therefore, also accessible with path URLs like `http://localhost:3000`.

```shell
my-app
  └── public/index.html ----------------------- http://localhost:3000/index.html, http://localhost:3000
```

But, where an `index.html` file pairs with a route...

```shell
my-app
  ├── server/index.js
  └── public/index.html
```

...the route handler determines what happens.

```js
/**
server
 ├── index.js
 */
export default async function(event, context, next) {
    // For http://localhost:3000/index.html, etc
    if (next.pathname) {
        return next();
    }
    // For http://localhost:3000 specifically
    return { ... };
}
```

Now, we are able to access the data component of a route differently from its HTML component!

```shell
my-app
  └── server/index.js ------------------------- http://localhost:3000 -------------------- application/json
  └── public/index.html ----------------------- http://localhost:3000/index.html --------- text/html
```

But, we can also access the route in a way that gets the data rendered into the automatically-paired `index.html` file for a dynamic page response. We'd simply set the [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header of the request to a value of `text/html`, and Webflo will automatically perform [Server-Side Rendering](#client-and-server-side-rendering) to give a page response. 

> **Note**
> <br>The `Accept` header hint is already how browsers make requests on every page load. Here, it just works!

This automatic pairing of an `index.html` file with a route works the same for nested routes! But top-level `index.html` files are implicitly inherited down the hierarchy.) That means that subroutes do not need to have their own `index.html` document, unless necessary.

#### Layout and Templating Overview

<details>
<summary>Some disambiguation...</summary>

> In a Single Page Application, all pages are based off a single `index.html` document. In a Multi Page Application, pages are individual `index.html`  documents - ideally. But, Server-Side Rendering makes it possible to serve the same, but dynamically-rendered, `index.html` document across page loads - essentially an SPA architecture hiding on the server. But, here, lets take Multi Page Applications for an individual-page architecture.
</details>

In a Multi Page Application (with an individual-page architecture), each page is its own `index.html` document, and it is often necessary to have certain page sections - e.g. site header, footer, and sidebar, etc. - stay consistent across pages. These sections can be defined once and *imported* on every page.

```html
my-app
  └── public
      ├── about/index.html ------------------------- <!DOCTYPE html>
      ├── products/index.html ---------------------- <!DOCTYPE html>
      ├── index.html ------------------------------- <!DOCTYPE html>
      ├── header.html ------------------------------ <header></header> <!-- To appear at top of each index.html page -->
      └── footer.html ------------------------------ <footer></footer> <!-- To appear at bottom of each index.html page -->
```

In a Single Page Application, each page is the same `index.html` document, and it is often necessary to have the main page sections change on each route. These sections can be defined per-route and *imported* to the document on navigating to their respective route.

```html
my-app
  └── public
      ├── about/main.html -------------------------- <main></main> <!-- To appear at main area of index.html -->
      ├── products/main.html ----------------------- <main></main> <!-- To appear at main area of index.html -->
      ├── main.html -------------------------------- <main></main> <!-- To appear at main area of index.html -->
      └── index.html ------------------------------- <!DOCTYPE html>
```

This, in both cases, is templating - the ability to define HTML *partials* once, and have them reused multiple times. Webflo just concerns itself with templating, and the choice of a Multi Page Application or Single Page Application becomes yours! And heck, you can even have the best of both worlds in the same application - with an architecture we'll call [Multi SPA](#in-a-multi-spa-layout)! It's all a *layout* thing!

Now, with pages in Webflo being [DOM-based](#overview) (both client-side and [server-side](#oohtml-ssr)), documents can be manipulated directly with DOM APIs, e.g. to replace or insert nodes, attributes, etc. But even better, templating in Webflo is based on the [HTML Modules](https://github.com/webqit/oohtml#html-modules) and [HTML Imports](https://github.com/webqit/oohtml#html-imports) features in [OOHTML](#oohtml) - unless disabled in config. These features provide a powerful declarative templating system on top of the standard [HTML `<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) element - all in a *module*, *export* and *import* paradigm.

Here, you are able to define reusable contents in a `<template>` element...

```html
<head>
    <template name="routes">
        <header exportgroup="header.html">Header Area</header>
        <main exportgroup="main.html">Main Area</main>
    </template>
</head>
```

...and have them imported anywhere on the root document using an `<import>` element:

```html
<body>
    <import template="routes" name="header.html"></import>
    <import template="routes" name="main.html"></import>
</body>
```

The *module* element - `<template>` - is also able to load its contents from a remote `.html` file that serves as a bundle:

```html
<!--
public
 ├── bundle.html
-->
<header exportgroup="header.html">Header Area</header>
<main exportgroup="main.html">Main Area</main>
```

```html
<!--
public
 ├── index.html
-->
<head>
    <template name="routes" src="/bundle.html"></template>
</head>
```

What [we'll see shortly](#bundling) is how multiple standalone `.html` files - e.g. those `header.html`, `footer.html`, `main.html` files above - come together into one `bundle.html` file for an application.

#### In a Multi Page Layout

In a Multi Page layout (as seen [earlier](#layout-and-templating-overview)), generic contents - e.g. header and footer sections, etc. - are typically bundled into one `bundle.html` file that can be embedded on each page of the application.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="routes" src="/bundle.html"></template>
    </head>
    <body>
        <import template="routes" name="header.html"></import>
        <main>Welcome to our Home Page</main>
        <import template="routes" name="footer.html"></import>
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
        <template name="routes" src="/bundle.html"></template>
    </head>
    <body>
        <import template="routes" name="header.html"></import>
        <main>Welcome to our About Page</main>
        <import template="routes" name="footer.html"></import>
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
        <template name="routes" src="/bundle.html"></template>
    </head>
    <body>
        <import template="routes" name="header.html"></import>
        <main>Welcome to our Products Page</main>
        <import template="routes" name="footer.html"></import>
    </body>
</html>
```

<details>
<summary>How it works...</summary>

> In this architecture, navigation is traditional - a new page loads each time. The `bundle.js` script comes with the appropriate OOHTML support level required for the imports to function.
</details>

#### In a Single Page Layout

In a Single Page layout (as seen [earlier](#layout-and-templating-overview)), page-specific contents - e.g. main sections - are typically bundled together into one `bundle.html` file that can be embedded on the document root. Notice how nested routes end up as nested `<template>` elements that form the equivalent of the application's URL structure.

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

Now, the `<main>` elements are each imported on navigating to their respective routes. This time, Webflo takes care of setting the URL path as a global `template` attribute on the `<body>` element such that `<import>` elements that inherit this global attribute are resolved from its current value.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/bundle.js"></script>
        <template name="routes" src="/bundle.html"></template>
    </head>
    <body template="routes/"> <!-- This "template" attribute automatically changes to routes/about or routes/products as we navigate to http://localhost:3000/about and http://localhost:3000/products respectively -->
        <header></header>
        <import name="main.html"></import> <!-- This import element omits its "template" attribute so as to inherit the global one -->
        <footer></footer>
    </body>
</html>
```

<details>
<summary>How it works...</summary>

> In this architecture, navigation is instant and sleek - Webflo prevents a full page reload, obtains and sets data at `document.state.data` for the new URL, then sets the `template` attribute on the `<body>` element to the new URL path. The `bundle.js` script comes with the appropriate OOHTML support level required for the imports to function.
</details>

#### In a Multi SPA Layout

It's all a *layout* thing, so a hybrid of the two architectures above is possible in one application, to take advantage of the unique benefits of each! Here, you are able to have routes that are standalone `index.html` documents (MPA), which in turn, are able to act as a single document root for their subroutes (SPA).

```html
my-app
  └── public
      ├── about/index.html ------------------------- <!DOCTYPE html> <!-- Document root 1 -->
      ├── products
      │     ├── free/main.html --------------------------- <main></main> <!-- To appear at main area of document root 2 -->
      │     ├── paid/main.html --------------------------- <main></main> <!-- To appear at main area of document root 2 -->
      │     ├── main.html -------------------------------- <main></main> <!-- To appear at main area of document root 2 -->
      │     └── index.html ------------------------------- <!DOCTYPE html> <!-- Document root 2, (doubles as an SPA) -->
      ├── index.html ------------------------------- <!DOCTYPE html> <!-- Document root 0 -->
      ├── header.html ------------------------------ <header></header> <!-- To appear at top of each document root -->
      └── footer.html ------------------------------ <footer></footer> <!-- To appear at bottom of each document root -->
```

The above gives us three document roots: `/index.html`, `/about/index.html`, `/products/index.html`. The `/products` route doubles as a Single Page Application such that visiting the `/products` route loads the document root `/products/index.html` and lets Webflo SPA routing determine which of `/products/main.html`, `/products/free/main.html`, `/products/paid/main.html` is imported on a given URL.

Webflo ensures that only the amount of JavaScript for a document root is actually loaded! So, above, a common JavaScript build is shared across the three document roots alongside an often tiny root-specific build.

```html
<!--
public
 ├── products/index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <script type="module" src="/webflo.bundle.js"></script>
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
        <script type="module" src="/webflo.bundle.js"></script>
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
        <script type="module" src="/webflo.bundle.js"></script>
        <script type="module" src="/bundle.js"></script>
        <template name="pages" src="/bundle.html"></template>
    </head>
    <body>...</body>
</html>
```

<details>
<summary>How it works...</summary>

> The Webflo `generate` command automatically figures out a given architecture and generates the appropriate scripts for the application! It also factors into the generated scripts the location of each document root so that [all navigations to these roots are handled as a regular page load](#spa-navigation).
</details>

#### Bundling

Template `.html` files are bundled from the filesystem into a single file using the [OOHTML CLI](#oohtml-cli) utility. On installing this utility, you may want to add the following to your npm scripts in `package.json`.

```json
"scripts": {
    "generate:templates": "oohtml bundle --recursive --auto-embed=routes"
}
```

The `--recursive` flag gets the bundler to recursively bundle *subroots* in a [Multi SPA](#in-a-multi-spa-layout) layout - where certain subdirectories have their own `index.html` document. (These subroots would be ignored otherwise.)

The `--auto-embed` flag gets the bundler to automatically embed the generated `bundle.html` file on the matched `index.html` document. A value of `routes` for the flag ends up as the name of the *embed* template: `<template name="routes" src="/bundle.html"></template>`.

> **Note**
> <br>If your HTML files are actually based off the `public` directory, you'll need to tell the above command to run in the `public` directory, either by [configuring the bundler](https://github.com/webqit/oohtml-cli#other-options), or by rewriting the command with a prefix: `cd public && oohtml bundle --recursive --auto-embed=routes`.

### Client and Server-Side Rendering

With pages in Webflo being [DOM-based](#overview) (both client-side and [server-side](#oohtml-ssr)), we are able to access and manipulate documents and elements using familiar DOM APIs - e.g. to replace or insert contents, attributes, etc. Rendering in Webflo is based on this concept!

Here, Webflo simply makes sure that the data obtained from each route is available as part of the `document` object as [`document.state.data`](#the-documentstatedata-object), making it accessible to our rendering logic.

We are able embed a script on our page and render this data on the relevant parts of the document.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <title></title>
        <script>
         setTimeout(() => {
             console.log( document.state.data ); // { title: 'Home | FluffyPets' }
             let { title } = document.state.data;
             document.title = title;
         }, 0);
        </script>
    </head>
    <body></body>
</html>
```

Where your rendering logic is an external script, your `<script>` element would need to have an `ssr` Boolean attribute to get the rendering engine to fetch and run your script on the server.

```html
<!--
public
 ├── index.html
-->
<!DOCTYPE html>
<html>
    <head>
        <title></title>
        <script src="app.js" ssr></script>
    </head>
    <body></body>
</html>
```

From here, even the most-rudimentary form of rendering (using vanilla HTML and native DOM methods) becomes possible, and this is a good thing: you get away with less tooling until you absolutely need to add up on tooling!

However, since the `document` objects in Webflo natively support [OOHTML](#oohtml) - unless disabled in config, we are able to write reactive UI logic! Here, OOHTML makes it possible to embed reactive `<script>` elements (called [Subscript](https://github.com/webqit/oohtml#subscript)) right within HTML elements - where each expression automatically self-updates whenever references to data, or its properties, get an update!

```html
 <!--
 public
  ├── index.html
 -->
 <!DOCTYPE html>
 <html>
     <head>
         <title></title>
     </head>
     <body>
         <h1></h1>
         <script type="subscript">
          let { title } = document.state.data;
          document.title = title;
          let h1Element = this.querySelector('h1');
          h1Element.innerHTML = title;
         </script>
     </body>
 </html>
```

<details>
<summary>Re-introducing UI logic in the actual language for logic - JavaScript...</summary>

> So, this is simple to think about: HTML already just let's us embed `<script>` elements for UI logic, and so be it! What OOHTML does further is simply to extend the plain old `<script>` element with the `subscript` type which gets any JavaScript code to be *reactive*! Compared with other syntax alternatives, this uniquely enables us to do all things logic in the actual language for logic - JavaScript.
</details>

Note that because these scripts are naturally reactive, we do not require any `setTimeout()` construct like we required earlier in the case of the classic `<script>` element. These expressions self-update as the values they depend on become available, removed, or updated - i.e. as `document.state` gets updated.

From here, we are also able to write more succinct code! Using the [Namespaced HTML](https://github.com/webqit/oohtml#namespaced-html) feature in OOHTML, we could do without those `querySelector()` calls up there. Also, we could go on to use any DOM manipulation library of our choice; e.g jQuery, or even better, the jQuery-like [Play UI](https://github.com/webqit/play-ui) library.

```html
 <!--
 public
  ├── index.html
 -->
 <!DOCTYPE html>
 <html>
     <head>
         <title></title>
         <script src="/jquery.js"></script>
     </head>
     <body namespace>
         <h1 id="headline1"></h1>
         <script type="subscript">
          let { title } = document.state.data;
          document.title = title;
          let { headline1, headline2 } = this.namespace;
          $(headline1).html(title);
          if (headline2) {
              $(headline2).html(title);
          }
         </script>
     </body>
 </html>
```

Above, we've also referenced some currently non-existent element `headline2` - ahead of when it becomes added in the DOM! This should give a glimpse of the powerful reactivity we get with having OOHTML around on our document!

```js
setTimeout(() => {
    let headline2 = document.createElement('h2');
    headline2.id = 'headline2';
    document.body.append(headline2);
}, 1000);
```

Taking things further, it is possible to write class-based components that abstract away all logic! You can find a friend in [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)! Plus, your Custom Elements can function reactively using [SubscriptElement](https://github.com/webqit/oohtml#subscript) as base class!

#### Custom Render Functions

Custom `render` functions can be defined on a route (`export function render() {}`) to entirely handle, or extend, rendering.

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

<details>
<summary>And, custom <code>render</code> functions can be step functions too, nested as necessary to form a <i>render</i> workflow.</summary>

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
</details>

But, custom render functions do not always need to do as much as entirely handle rendering. It is possible to get them to trigger Webflo's native rendering and simply modify the documents being rendered. Here, you would simply call the `next()` function to advance the *render workflow* into Webflo's default rendering. A `window` instance is returned containing the document being rendered.

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
    console.log( document.state.data ); // { title: 'Home | FluffyPets' }
    return window;
}
```

Custom render functions must return a value, and `window` objects are accepted. (Actually, any object that has a `toString()` method can be returned.)

#### The Idea of State

There often needs to be a central point in an application where things are stored and managed. You could think of it as having a global object initialized `window.store = {}` on which different parts of an application can store and retrieve values. This is the basic idea of state. But it also doesn't go without the idea of *observability* - something that lets the different parts of the application observe and respond to changes made on this object!

*State* and *Observability* in Webflo applications come down to the same basic form:

first, an object...

```js
document.state = {};
// and for elements: element.state = {};
```

...and then, a way to observe property changes on it...

```js
Observer.observe(document.state, changes => {
    changes.forEach(change => {
        console.log(change.name, change.value);
    });
});
```

```js
Observer.observe(document.state, propertyName, change => {
    console.log(change.name, change.value);
});
```

...and with incredible syntax benefits - where all references to the object and its properties from within embedded Subscript code are reactive.

```html
<script type="subscript">
    // Always log the value of this property in realtime
    console.log(document.state.propertyName);
</script>
```

Look, this covers it all: state management and reactive UIs, with none of a state machine!

Interestingly, this idea of "state" is all of OOHTML's: the [State API](https://github.com/webqit/oohtml#state-api) that's natively available in OOHTML-based documents - both client-side and server-side! Webflo simply just leverages it!

This API exposes an application-wide `document.state` object and a per-element `element.state` object. And these are *live* read/write objects that can be observed for property changes using the [Observer API](#the-observer-api). It comes off as the simplest approach to state and reactivity!

> **Note**
> <br>The State API is available as long as the [OOHTML support level](#oohtml) in config is left as `full`, or set to `scripting`.

#### The `document.state.data` Object

This property reperesents the application data at any point in time - obtained from route handers on each navigation. Webflo simply updates this property and lets the page's [rendering logic](#client-and-server-side-rendering), or other parts of the application, take over.

```js
console.log(document.state.data) // { title: 'Home | FluffyPets' }
```

<details>
<summary>More examples...</summary>

```js
Observer.observe(document.state, 'data', e => {
    console.log('Current page data is: ', e.value);
});
```

```html
<script type="subscript">
 let { data: { title } } = document.state;
 document.title = title;
</script>
```
</details>

#### The `document.state.url` Object

This is a *live* object that reperesents the properties of the application URL at any point in time. The object exposes the same URL properties as of a standard [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) object, but, here, as *live* properties that can be observed as navigation happens, and modified to initiate navigation - all using the [Observer API](#the-observer-api).

```js
let { url } = document.state;
console.log(url) // { hash, host, hostname, href, origin, password, pathname, port, protocol, search, searchParams, username }
```

<details>
<summary>More examples...</summary>

```js
Observer.observe(url, 'hash', e => {
    console.log(url.hash === e.value); // true
});
```

```js
// Navigates to "/login#form" as if a link was clicked
document.addEventListener('synthetic-navigation', e => {
    Observer.set(url, 'href', '/login#form');
});

// Or...
document.addEventListener('synthetic-navigation', e => {
    Observer.set(url, { pathname: '/login', hash: '#form' });
});

console.log(url.hash); // #form
```

There is also the *convenience* `query` property that offers the URL parameters as a *live* object.

```js
// For URL: http://localhost:3000/login?as=student
console.log(url.query.as) // student

// Re-rewrite the URL and initiate navigation by simply modifying a query parameter
document.addEventListener('synthetic-navigation', e => {
    Observer.set(url.query, 'as', 'business');
});
```

```html
<script type="subscript">
 let { query: { as: role } } = url;
 document.title = 'Login as ' + role;
</script>
```
</details>

### Requests and Responses

On each request, the event object passed to route handlers exposes the incoming request as `event.request`. This is an instance of `event.Request` - an extension of the [WHATWG Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) class. The event object also exposes `event.Response` - an extension of the [WHATWG Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) class, for returning instance-based responses. You enjoy routing that is based on standard interfaces!

Routes in Webflo can be designed for different types of request/response scenarios. Here are some important ones:

#### Scenario 1: Static File Requests and Responses

Static file requests like `http://localhost:3000/logo.png` are automatically responded to by Webflo when `next()`ed forward by route handlers, or where there are no route handlers.
+ On the server, Webflo serves files from the `public` directory. File contents along with the appropriate headers like [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type), [`Content-Length`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length), etc. are returned as an instance of `event.Response`. Where a request has an [`Accept-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding) header set (e.g. `gzip`, `br`) and there exists a matching *compressed version* of the said file on the file system (e.g. `./public/logo.png.gz`, `./public/logo.png.br`), the compressed version is served and the appropriate [`Content-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding) response header is set.

#### Scenario 2: API Requests and Responses

JSON (API) requests - requests that expect to get a JSON response (i.e. [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type): `application/json`) - are automatically satisfied by Webflo with a valid JSON response. Here, Webflo simply jsonfies workflow return values - which are usually plain objects, or other jsonfyable types - `string`, `number`, `boolean`, `array`.
+ These requests need not have an [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header; but if they should, it must be the value of `application/json`.
+ Routes intended to be accessed this way are expected to return a jsonfyable value (or an instance of `event.Response` containing same) from the workflow.
+ Workflow responses that are an instance of `event.Response` with a `Content-Type` header already set are sent as-is.

#### Scenario 3: Page Requests and Responses

HTML page requests - requests that expect to get an HTML response (i.e. [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type): `text/html`) - are automatically satisfied by Webflo with a valid HTML response. Workflow return values that are objects are automatically used for [Server-Side Rendering](#client-and-server-side-rendering).
+ These requests need to have an [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) header of `text/html`, or something that resolves to `text/html` - e.g. `text/*`, `*/html`, `*/*`.
+ Routes intended to be accessed this way are expected to return a plain object (or an instance of `event.Response` containing same) from the workflow in order to be renderable.
+ Workflow responses that are an instance of `event.Response` with a `Content-Type` header already set are sent as-is, and not rendered.

#### Scenario 4: Single Page Navigation Requests and Responses

In a Single Page Application layout, every navigation event (page-to-page navigation, history back and forward navigation, and form submissions) is expected to initiate a request/response flow without a full page reload, since the destination URLs are often based off the already loaded document. The Webflo client JS intercepts these navigation events and generates the equivalent request object with an `Accept` header of `application/json`, so that data can be obtained as a JSON object ([scenerio 2 above](#scenario-2-api-requests-and-responses)) for [Client-Side Rendering](#client-and-server-side-rendering). 

The generated request also [hints the server](#custom-redirect-responses) on how to return cross-SPA redirects (redirects that will point to another origin, or to another SPA root (in a [Multi SPA](#in-a-multi-spa-layout) layout)) so that it can be handled manually by the client. The following headers are set: `X-Redirect-Policy: manual-when-cross-spa`, `X-Redirect-Code: 200`.
+ Same-SPA redirects are sent as-is, and the Webflo client JS receives and renders the final data and updates the address bar with the final URL.
+ Cross-SPA/cross-origin redirects are communicated back, as hinted, and the destination URL is opened as a fresh page load.

#### Scenario 5: Range Requests and Responses

In all cases, where a request specifies a [`Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range) header, Webflo automatically slices the response body to satisfy the range, and the appropriate [`Content-Range`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range) response header is set.
+ Workflow responses that are an instance of `event.Response` with a `Content-Range` header already set are sent as-is.

#### Other Requests and Responses

Workflows may return any other data type, e.g. an instance of the native [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [File](https://developer.mozilla.org/en-US/docs/Web/API/File), or [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), etc., or an instance of `event.Response` containing same - usually on routes that do not double as a page route. Webflo tries to send these along with the appropriate response headers.

> **Note**
> <br>The fact that all requests, even static file requests, are seen by route handlers, where defined, means that they get a chance to dynamically generate the responses that the client sees!

#### Custom Redirect Responses

It is possible to hint the server on how to serve redirect responses. The idea is to substitute the standard `302`, `301` response code for these redirects with a non-rediret status code so that it can be recieved as a normal response and handled manually. The following pair of headers make this possible: `X-Redirect-Code`, `X-Redirect-Policy`.
+ The `X-Redirect-Code` can be any valid HTTP status code (often preferably, in the 2xx). This is the response code that you want Webflo to substitute the actual redirect code with.
+ The `X-Redirect-Policy` header can be any of:
  + `manual` - which means "treat all redirects as manual"
  + `manual-if-cross-origin` - which means "treat cross-origin redirects as manual"
  + `manual-if-cross-spa` - which means "treat cross-SPA redirects (including cross-origin redirects) as manual"

  In each case, the substituted, original redirect code is returned back in the response in a special `X-Redirect-Code` response header, alongside the standard `Location` header.

#### Failure Responses

Where workflows return `undefined`, a `Not Found` status is implied.
+ On the server side, a `404` HTTP response is returned.
+ On the client-side, the initiating document in the browser has its `document.state.data` emptied. The error is also exposed on the [`document.state.network.error`](#the-documentstatenetwork-object) property.

Where workflows throw an exception, an *error* status is implied.
+ On the server side, the error is logged and a `500` HTTP response is returned.
+ On the client-side, the initiating document in the browser has its `document.state.data` emptied. The error is also exposed on the [`document.state.network.error`](#the-documentstatenetwork-object) property.

#### Cookie Responses

Handlers can set [response cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie) via the standard `Response` constructor, or using the standard `Headers.set()` method.

<details>
<summary>Examples...</summary>

```js
let response = event.Response(data, { headers: { 'Set-Cookie': cookieString }});

response.headers.set('Set-Cookie', cookieString);
```

Webflo also offers a *convenience* method.

```js
let response = event.Response(data, { headers: { cookies: cookieString }});

response.headers.cookies = { 'Cookie-1': cookieString, 'Cookie-2': cookie2String };
```

```js
let cookieObject = { value: 'cookie-val', expires, maxAge, domain, path, secure, HttpOnly, sameSite };
let cookie2Object = { value: 'cookie2-val' };
response.headers.cookies = { 'Cookie-1': cookieObject };
response.headers.cookies = { 'Cookie-2': cookie2Object };

console.log(response.headers.cookies); // { 'Cookie-1': cookieObject, 'Cookie-2': cookie2Object };
```

Set cookies are [accessed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie) on the next request via request headers.

```js
console.log(event.request.headers.get('Cookie')); // Cookie-1=cookie-val&Cookie-2=cookie2-val;
```

Webflo also offers a *convenience* method.

```js
console.log(event.request.headers.cookies); // { 'Cookie-1': 'cookie-val', 'Cookie-2': 'cookie2-val' };
```
</details>

### Webflo Applications

Webflo comes ready for any type of application!

+ [Client-Side Applications](#client-side-applications)
+ [Progressive Web Apps](#progressive-web-apps)
+ [API Backends](#api-backends)
+ [Static Sites](#static-sites)

*And you can go hybrid!*

#### Client-Side Applications

Web pages that embed the Webflo client JS deliver a great user experience. It's simple: the `npm run generate` command does both the building and embedding of the script (or scripts), for the document root (or document roots - in a [Multi Page](#in-a-multi-page-layout) / [Multi SPA](#in-a-multi-spa-layout) layout)!

On being loaded, the state of the application is initialized, or is restored through hydration - where [Server-Side Rendering](#client-and-server-side-rendering) was involved to optimize for first paint, and an app-like experience kicks in! For [Single-Page Applications](#in-a-single-page-layout), [Client-Side Rendering](#client-and-server-side-rendering) is performed on each navigation.

##### SPA Navigation

Unless disabled in config, it is factored-in at build time for the application client JS to be able to automatially figure out when to intercept a navigation event and prevent a full page reload, and when not to.

<details>
<summary>How it works...</summary>

SPA Navigation follows the following rules:

+ When it ascertains that the destination URL is based on the current running `index.html` document in the browser (an SPA architecture), a full page reload is prevented for *soft* navigation. But where the destination URL points out of the current document root (a [Multi SPA](#in-a-multi-spa-layout) architecture), navigation is allowed as a normal page load, and a new page root is loaded.
+ If navigation is initiated with any of the following keys pressed: Meta Key, Alt Key, Shift Key, Ctrl Key, navigation is allowed to work the default way - regardless of the first rule above.
+ If navigation is initiated from a link element that has the `target` attribute, or the `download` attribute, navigation is allowed to work the default way - regardless of the first rule above.
+ If navigation is initiated from a form element that has the `target` attribute, navigation is allowed to work the default way - regardless of the first rule above.
</details>

<details>
<summary>Config (Default)</summary>

```json
{ "spa_navigation": true }
```

> **File: `.webqit/webflo/client.json`**

> **Command: `webflo config client spa_navigation=TRUE`**
</details>

##### SPA State

On the client side of a Webflo application, [the idea of state](#the-idea-of-state) also includes the following aspects of the client-side lifecycle that can be used to provide visual cues on the UI.
  
###### The `document.state.network` Object

This is a *live* object that exposes the network activity and network state of the application.

```js
console.log(document.state.network) // { requesting, remote, error, redirecting, connectivity, }
```

<details>
<summary>Property: <code>.network.requesting: null|Object</code></summary>

This property tells when a request is ongoing, in which case it exposes the `params` object used to initiate the request.

On the UI, this could be used to hide a menu drawer that may have been open.

```html
<menu-drawer>
    <script type="subscript">
    let { network: { requesting } } = document.state;
    if (requesting) {
        $(this).attr('open', false);
    }
    </script>
</menu-drawer>
```
</details>

<details>
<summary>Property: <code>.network.remote: null|String</code></summary>

 This property tells when a remote request is ongoing - usually the same navigation requests as at `network.requesting`, but when not handled by any client-side route handlers, or when `next()`ed to this point by route handlers. The `remote` property also goes live when a route handler calls the special `fetch()` function that they recieve on their fourth parameter.

On the UI, this could be used to show/hide a spinner, or progress bar, to provide a visual cue.

```html
<progress-bar>
    <script type="subscript">
    let { network: { remote } } = document.state;
    $(this).attr('hidden', !remote);
    </script>
</progress-bar>
```
</details>

<details>
<summary>Property: <code>.network.error: null|Error</code></summary>

This property tells when a request is *errored* in which case it contains an `Error` instance of the error. For requests that can be retried, the `Error` instance also has a custom `retry()` method.

On the UI, this could be used to show/hide cute error elements.

```html
<nice-error>
    <script type="subscript">
    let { network: { error } } = document.state;
    $(this).attr('hidden', !error);
    </script>
</nice-error>
```
</details>

<details>
<summary>Property: <code>.network.redirecting: null|String</code></summary>

This property tells when a client-side redirect is ongoing - see [Scenario 4: Single Page Navigation Requests and Responses](#scenario-4-single-page-navigation-requests-and-responses) - in which case it exposes the destination URL.

On the UI, this could be used to mark the current page as stale and prevent further interactions.

```html
<body>
    <script type="subscript">
    let { network: { redirecting } } = document.state;
    $(this).css(redirecting ? { pointerEvents: 'none', filter: 'blur(2)' } : { pointerEvents: 'auto', filter: 'blur(0)' });
    </script>
</body>
```
</details>

<details>
<summary>Property: <code>.network.connectivity: String</code></summary>

This property tells of [the browser's ability to connect to the network](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine): `online`, `offline`.

On the UI, this could be used to show/hide a connectivity status.

```html
<body>
    <script type="subscript">
    let { network: { connectivity } } = document.state;
    $(this).attr( 'connectivity', connectivity });
    </script>
</body>
```
</details>
  
Here are some additional examples with the [Observer API](#the-observer-api).

<details>
<summary>Visualize the network state...</summary>

```js
// Visualize the network state
let networkVisualizer = changes => {
    changes.forEach(e => {
        console.log(e.name, ':', e.value);
    });
};
Observer.observe(document.state.network, networkVisualizer);
// Or: Observer.observe(document, [ ['state', 'network'] ], networkVisualizer, { subtree: true });
```
</details>

<details>
<summary>Visualize "connectivity"...</summary>

```js
// Visualize the 'connectivity' property
let connectivityVisualizer = e => {
    console.log('You are ', e.value);
};
Observer.observe(document.state.network, 'connectivity', connectivityVisualizer);
// Or: Observer.observe(document.state, [ ['network', 'connectivity'] ], connectivityeVisualizer);
```
</details>

<details>
<summary>Catch request errors; attempt a retry...</summary>

```js
// Catch request errors; attempt a retry
Observer.observe(document.state.network, 'error', e => {
    if (!e.value) return;
    console.error(e.value.message);
    if (e.value.retry) {
        console.error('Retrying...');
        e.value.retry();
    }
});
```
</details>

##### Form Actions

When navigation occurs [via form submissions](#scenario-4-single-page-navigation-requests-and-responses), the form element and the submit button are made to go on the *active* state while the request is being processed. For both of these elements, the Webflo client simply sets the `element.state.active` to `true` on submission, then `false`, on completion.

```html
<form method="post">
    <input name="username" placeholder="Your username..." />
    <script>
    $(this).css(this.state.active ? { pointerEvents: 'none', opacity: 'o.5' } : { pointerEvents: 'auto', opacity: '1' });
    </script>
</form>
```

Also, you'd remember that HTML forms can only accept two HTTP methods on their `method` attribute: `GET`, `POST`! And the same constraint exists on the equivalent `formmethod` attribue in submit buttons. You are able to overcome this in Webflo by using alternative `data-` attributes: `data-method`, `data-formmethod`, respectively.

```html
<form data-method="patch">
    <input name="price" placeholder="Enter new price..." />
</form>
```

#### Progressive Web Apps

Webflo client-side applications are intended to provide an app-like-first experience. So unless disabled in config, a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) is built as part of your application on running the `npm run generate` command. And as covered above, you may define [route handlers in the `/worker` directory](#handler-functions-and-layout) of your application, and these will be built into the service worker to handle Same-Origin requests of the application. Where there are no *worker* handlers, or where these forward incoming requests, requests are fetched, either from the cache, or from the network, depending on the fetching strategy built into the Service Worker.

<details>
<summary>Config (Default)</summary>

```json
{ "service_worker_support": true }
```

> **File: `.webqit/webflo/client.json`**

> **Command: `webflo config client service_worker_support=TRUE`**
</details>

##### Fetching Strategy

<details>
<summary>Network First</summary>

This strategy tells the Service Worker to always attempt fetching from the network first for given resources, before fetching from the cache. On every successful network fetch, a copy of the response is saved to the cache for next time. (This is good for resources that need to be fresh to the user on a "best effort" basis.) Unless changed, this is Webflo's default fetching strategy. When not the default strategy, a list of specific URLs that should be fetched this way can be configured.

<details>
<summary>Config (Default)</summary>

```json
{ "default_fetching_strategy": "network-first" }
```

*To list specific URLs...*

```json
{ "network_first_urls": [ "/logo.png" ] }
```

> **File: `.webqit/webflo/worker.json`**

> **Command: `webflo config worker default_fetching_strategy=network-first`**
</details>
</details>

<details>
<summary>Cache First</summary>

This strategy tells the Service Worker to always attempt fetching from the cache first for given resources, before fetching from the network. After serving a cached response, or where not found in cache, a network fetch happens and a copy of the response is saved to the cache for next time. (This is good for resources that do not critially need to be fresh to the user.) When not the default strategy, a list of specific URLs that should be fetched this way can be configured.

<details>
<summary>Config</summary>

```json
{ "default_fetching_strategy": "cache-first" }
```

*To list specific URLs...*

```json
{ "cache_first_urls": [ "/logo.png" ] }
```

> **File: `.webqit/webflo/worker.json`**

> **Command: `webflo config worker default_fetching_strategy=cache-first`**
</details>
</details>

<details>
<summary>Network Only</summary>

This strategy tells the Service Worker to always fetch given resources from the network only. They are simply not available when offline. (This is good for resources that critially need to be fresh to the user.) When not the default strategy, a list of specific URLs that should be fetched this way can be configured.

<details>
<summary>Config</summary>

```json
{ "default_fetching_strategy": "network-only" }
```

*To list specific URLs...*

```json
{ "network_only_urls": [ "/logo.png" ] }
```

> **File: `.webqit/webflo/worker.json`**

> **Command: `webflo config worker default_fetching_strategy=network-only`**
</details>
</details>

<details>
<summary>Cache Only</summary>

This strategy tells the Service Worker to always fetch given resources from the cache only. (This is good for resources that do not change often.) When not the default strategy, a list of specific URLs that should be fetched this way can be configured. The listed resources are pre-cached ahead of when they'll be needed - and are served from the cache each time. (Pre-caching happens on the one-time `install` event of the Service Worker.)

<details>
<summary>Config</summary>

```json
{ "default_fetching_strategy": "cache-only" }
```

*To list specific URLs...*

```json
{ "cache_only_urls": [ "/logo.png" ] }
```

> **File: `.webqit/webflo/worker.json`**

> **Command: `webflo config worker default_fetching_strategy=cache-only`**
</details>
</details>

In all cases above, the convention for specifying URLs for a strategy accepts an [URL pattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) - against which URLs can be matched on the fly. For example, to place all files in an `/image` directory (and subdirectories) on the *Cache First* strategy, the pattern `/image/*` can be used. To place all `.svg` files in an `/icons` directory (including subdirectories) on the *Cache Only* strategy, the pattern `/icons/*.svg` can be used. (Specifically for the *Cache Only* strategy, patterns are resolved at Service Worker build-time, and each pattern must match, at least, a file.)

<details>
<summary>Example...</summary>

```json
{ "cache_only_urls": [ "/icons/*.svg" ] }
```
</details>

##### Cross-Thread Communications

A couple APIs exists in browsers for establishing a two-way communication channel between a page and its Service Worker, for firing UI Notifications from either ends, and for implementing Push Notifications. Webflo offers to simply this with a unifying set of conventions:

###### The `workport` API

This is an object with simple methods for working with *cross-thread* messages, UI Notifications, and Push Notifications.

On both the client and worker side of your application, the `workport` object is accessible from route handlers as `this.runtime.workport`.

```js
/**
 [client|worker]
├── index.js
*/
export default async function(event, context, next) {
    let { workport } = this.runtime;
    workport.messaging.post({ ... });
    return { ... };
}
```

For cross-thread messaging, both sides of the API exposes the following methods:

<details>
<summary>Method: <code>.messaging.post()</code></summary>

The `.messaging.post()` method is used for sending any arbitrary data to the other side. E.g. `workport.messaging.post({ type: 'TEST' })`.
</details>

<details>
<summary>Method: <code>.messaging.listen()</code></summary>

The `.messaging.listen()` method is used for registering a listener to the `message` event from the other side. E.g. `workport.messaging.listen(event => console.log(event.data.type))`. (See [`window: onmessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event), [`worker: onmessage`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/message_event).)
</details>

<details>
<summary>Method: <code>.messaging.request()</code></summary>

The `.messaging.request()` method is used for sending a message to the other side and obtaing a response, using the [MessageChannel](https://developer.mozilla.org/docs/Web/API/MessageChannel/MessageChannel) API.

```js
// On the worker side
workport.messaging.listen(event => {
console.log(event.data);
    if (event.ports[0]) {
        event.ports[0].postMessage({ type: 'WORKS' });
    }
});
```

```js
// On the client side
let response = await workport.messaging.request({ type: 'TEST' });
console.log(response); // { type: 'WORKS' }
```
</details>

<details>
<summary>Method: <code>.messaging.channel()</code></summary>

The `.messaging.channel()` method is used for sending *broadcast* messages to the other side - including all other browsing contents that live on the same origin, using the [Broadcast Channel](https://developer.mozilla.org/docs/Web/API/Broadcast_Channel_API) API.

```js
// On the worker side
let channelId = 'channel-1';
workport.messaging.channel(channelId).listen(event => {
    console.log(event.data);
});
```

```js
// On the client side
let channelId = 'channel-1';
workport.messaging.channel(channelId).broadcast({ type: 'TEST' });
```
</details>

For [UI Nofitications](https://developer.mozilla.org/en-US/docs/Web/API/notification), both sides of the API exposes the following methods:

<details>
<summary>Method: <code>.nofitications.fire()</code></summary>

The `.nofitications.fire()` method is used for firing up a UI notification. This uses the [`Nofitications constructor`](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification), and thus, accepts the same arguments as the constructor. But it returns a `Promise` that resolves when the notification is *clicked* or *closed*, but rejects when the notification encounters an error, or when the application isn't granted the [notification permission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission).

```js
let title = 'Test Nofitication';
let options = { body: '...', icon: '...', actions: [ ... ] };
workport.nofitications.fire(title, options).then(event => {
    console.log(event.action);
});
```
</details>

<details>
<summary>Method: <code>.nofitications.handle()</code></summary>

The `.nofitications.handle()` method (in Service-Workers) is used for handling [`notificationclick`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event) events. (Handlers are called each time a notification is clicked.)

```js
workport.nofitications.handle(event => {
    console.log(event.action);
});
```
</details>

For [Push Nofitications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), the client-side of the API exposes the following methods:

<details>
<summary>Method: <code>.push.subscribe()</code></summary>

The `.push.subscribe()` method is the equivalent of the [`PushManager.subscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) method. (But this can also take the *applicationServerKey* as a first argument, and other options as a second argument, in which case it automatically runs the key through an `urlBase64ToUint8Array()` function.)
</details>

<details>
<summary>Method: <code>.push.unsubscribe()</code></summary>

The `.push.unsubscribe()` method is the equivalent of the [`PushSubscription.unsubscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/unsubscribe) method.
</details>

<details>
<summary>Method: <code>.push.getSubscription()</code></summary>

The `.push.getSubscription()` method is the equivalent of the [`PushManager.getSubscription()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/getSubscription) method.
</details>

The worker-side of the API exposes the following methods:

<details>
<summary>Method: <code>.push.listen()</code></summary>

The `.push.listen()` method is for listening to the [`push`](https://developer.mozilla.org/en-US/docs/Web/API/PushEvent) from within Service Workers. E.g. `workport.push.listen(event => console.log(event.data.type))`.
</details>

###### Route *events*

These are simple route events that fire when messaging and notification events happen.

On both the client and worker side of your application, you can define an event listener alongside your *root* route handler. The event listener is called to handle all messaging and notification events that happen.

```js
/**
 [client|worker]
├── index.js
*/
export default async function(event, context, next) {
    return { ... };
}
export async function alert(event, context, next) {
    return { ... };
}
```

The event type is given in the `event.type` property. This could be:

+ **`message`** - both client and worker side. For *replyable* messages, the event handler's return value is automatically sent back as response.
+ **`notificationclick`** - worker side.
+ **`push`** - worker side.

<details>
<summary>Advanced...</summary>

The `next()` function could be used to delegate the handling of an event to step handlers where defined. This time, the path name must be given as a second argument to the call.

```js
/**
 worker
├── index.js
*/
export async function alert(event, context, next) {
    if (event.type === 'push') {
        await next(context, '/services/push');
        return;
    }
    console.log(event.type);
}
```
</details>

#### API Backends

In Webflo, an API backend is what you, in essence, come off with with your server-side routes.

```js
/**
server
 ├── index.js
 */
export default function(event, context, next) {
    if (next.pathname) return next();
    return { ... };
}
```

You are always able to lay out your route handlers in the structure for a formal REST API.

```shell
server
 ├── index.js
 ├── api/v1/index.js
 └── api/v1/products/index.js
```

And if you will partition your backend for both page routes and a formal REST API...

```shell
server
 ├── index.js                  ──┐
 ├── cart/index.js               ├─ Page Routes
 ├── products/index.js         ──┘
 ├── api/v1/index.js           ──┐
 ├── api/v1/orders/index.js      ├─ REST API
 └── api/v1/products/index.js  ──┘
```

...you could get your page routes to run off your REST API by re-routing your `next()` calls to consume the appropriate API route.

```js
/**
server
 ├── cart/index.js
 */
export default async function(event, context, next) {
    if (next.pathname) {
        return next();
    }
    // Items to display in cart are in the "/api/v1/orders" route
    let cartItems = await next(context, `/api/v1/orders?user_id=1`);
    return { title: 'Your Cart', ...cartItems };
}
```

This way, there is one source of truth for your application - both when visiting from a page and from a REST API.

#### Static Sites

You can build an entire static site from off the `/public` directory alone! It's all about placing files and HTML pages there to be served statically! 

Here, static pages means pages that are not server-rendered during the request/response cycle, but served directly from files. You are free to hand-author each of them - either as standalone `index.html` files, or as a combination of `index.html` *roots* plus *templates* that can all get resolved client-side. The [Pages, Layout and Templating](https://github.com/webqit/webflo/blob/master/README.md#pages-layout-and-templating) section covers layout patterns.

On the other hand, if you have a dynamic site, you can make a static site off it! The idea is to turn on your server and crawl your dynamic site via HTTP requests, outputting static HTML representations of each page. This is called *Pre-Rendering* or *Static-Site Generation* (SSG)!

A simple tool, like [`staticgen`](https://github.com/tj/staticgen), or the basic [`wget`](https://www.gnu.org/software/wget/) command (similar to `curl`), can get this done in an instant. On figuring out the command that works best for you, you may want to add an alias of the command to your npm scripts in `package.json`.


```json
"scripts": {
    "generate:site": "wget -P public -nv -nH -r -E localhost:3000"
}
```

<details>
<summary>How it works...</summary>

> Above, we used the `-P` flag to specify the output directory as `public`, the `-nv` flag to opt into “non-verbose” mode which outputs less information, the `-r` flag to get it to crawl and download recursively, and the `-E` flag to get it to add the `.html` extension to generated files.
</details>

*Happy static!*

## Webflo Config

Webflo comes *convention-first*! But it is entirely configurable for when you need it! The easiest way to do this is to run the command `webflo config` and follow the walkthrough. To simply get an overview, use the command `webflo config help`, and all commands and their description are shown.

## Webflo Tooling

Webflo applications are often built on/with the following technologies.

+ [OOHTML](#oohtml)
+ [OOHTML SSR](#oohtml-ssr)
+ [OOHTML CLI](#oohtml-cli)
+ [The Observer API](#the-observer-api)

### OOHTML

[OOHTML](https://github.com/webqit/oohtml) is a proposed set of new features for HTML that makes it fun to hand-author your HTML documents! Within OOHTML are [HTML Modules](https://github.com/webqit/oohtml#html-modules) and [HTML Imports](https://github.com/webqit/oohtml#html-imports), [Reactive Scripts](https://github.com/webqit/oohtml#subscript) and more!

Webflo natively supports OOHTML in full! But it is also possible to switch this to none, or to partial support - when specific features aren't needed anywhere in your application. Server-side and client-side support for OOHTML exist independently. This is good when, for example, your application places more importance on SSR, and less on CSR, in which case a reduced support for OOHTML can reduce the overall client JS size.

<details>
<summary>Config (Default)</summary>

```json
{ "oohtml_support": "full" }
```

*Values: `full`, `namespacing`, `scripting`, `templating`, `none` - See [details at OOHTML SSR](https://github.com/webqit/oohtml-ssr#options)*

> **File: `.webqit/webflo/client.json`**

> **Command: `webflo config client oohtml_support=full`**

> File: `.webqit/webflo/server.json` | Command: `webflo config server oohtml_support=full`
</details>


### OOHTML SSR

[OOHTML SSR](https://github.com/webqit/oohtml-ssr) is a server-side DOM implementation with native support for OOHTML. This is internally used by Webflo as the Server-Side Rendering engine, and it it what gives Webflo its native support for OOHTML.

### OOHTML CLI

[OOHTML CLI](https://github.com/webqit/oohtml-cli) is a small Command Line utility that automates certain aspects of hand-authored OOHTML-based documents.

### The Observer API

[The Observer API](https://github.com/webqit/observer) is a simple set of functions for intercepting and observing JavaScript objects and arrays. (Reflection, Interception, and Events.)

This is part of OOHTML's reactivity system, and it is made available on OOHTML-based documents as `window.WebQit.Observer`.

## Getting Started

Your baby steps with Webflo could be a ["Hello World" `index.html` file](#installation), optionally, next with a route handler that returns an equivalent  `{ title: 'Hello World'}` object!

You could soon be taking all your ideas to Webflo! 😃

## Getting Involved

All forms of contributions and PR are welcome! To report bugs or request features, please submit an [issue](https://github.com/webqit/webflo/issues). For general discussions, ideation or community help, please join our github [Discussions](https://github.com/webqit/webflo/discussions).

## License

MIT.
