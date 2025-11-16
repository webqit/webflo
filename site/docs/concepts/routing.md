# Webflo Routing

Functions come into play in Webflo when you need to dynamically handle requests.
Routing defines how those requests map to functions in a Webflo application.
It determines which handler responds to a given URL, how requests move across layers of the stack, and how each step in that process composes into a complete response.

## Layout Convention

In Webflo, **your filesystem *is* the router**.
Each folder under `app/` corresponds to a segment in your application’s URL path, and each handler file in that folder defines what happens at that segment.

```html
app/
├── handler.server.js                       →  /
├── about/handler.server.js                 →  /about
├── products/handler.server.js              →  /products
└── products/stickers/handler.server.js     →  /products/stickers
```

Handlers can be designed to match any segment using wildcards.
A folder named `-` acts as a catch-all at its level.

```html
app/
├── -/handler.server.js                     →  /*
└── products/-/handler.server.js            →  /products/*
```

## Handlers

Handlers are standard JavaScript functions that process requests and return responses.
They share the same base signature:

```js
export default async function (event, next, fetch) {
    if (next.stepname) return await next();
    return { title: 'Welcome to Webflo' };
}
```

A route may provide **[named exports](/api/webflo-routing/handler#naming)** to map specific HTTP requests to specific handlers:

```js
export async function GET(event, next) { /* ... */ }
```

Handlers are fully covered in the [Handler API](/api/webflo-routing/handler) section, but below is an overview.

### Parameters

Parameters recieved include:

| Parameter | Type                               | Description                                              |
| :-------- | :--------------------------------- | :------------------------------------------------------- |
| `event`   | [`HttpEvent`](/api/webflo-routing/HttpEvent)      | Current HTTP event.                                      |
| `next`    | [`next`](/api/webflo-routing/handler/next)        | Control delegation function.                             |
| `fetch`   | [`fetch`](/api/webflo-routing/handler/fetch)      | Context-aware fetch API for inbound and outbound calls.  |

### Contextual Parameters

Within a handler, contextual properties are available on the [`this`](/api/webflo-routing/handler#the-this-context) and [`next`](/api/webflo-routing/handler/next) interfaces:

| Property        | Type            | Description                                                       |
| :-------------- | :-------------- | ----------------------------------------------------------------- |
| `next.stepname` | `string`        | The name of the next segment in the URL.                          |
| `next.pathname` | `string`        | The full path _beyond_ the the active step.                       |
| `this.stepname` | `string`        | The current directory segment being handled.                      |
| `this.pathname` | `string`        | The current URL pathname _up to_ the active step.                 |  
| `this.filename` | `string`        | The filename of the executing handler (server-side only)          |

Use these for conditional delegation, or per-segment rules.

### Your First Handler (Again)

Your application's routes may be designed with as many or as few handlers as desired.<br>
The contextual parameters `next.stepname` and `next.pathname` totally make it possible to fit routing logic into a single handler.

```js
export default function(event, next) {
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

But the power of Webflo routing model really shines as you spread out to more handlers.

## The Delegation Model

In Webflo, nested URLs such as `/products/stickers` don’t directly invoke their corresponding leaf handler (`app/products/stickers/handler.server.js`) in isolation.
Instead, requests are handled **step-by-step — from parent to child**, forming a **pipeline**.

The `next()` function is how a handler delegates control to the next step in that pipeline.

This is simulated below for a URL like `/products/stickers`.<br>
Each handler uses `next()` to delegate, and the final step returns the response.

```js
┌──────────┐   ┌──────────────┐    ┌──────────────────┐
│ app/     │ → │ products/    │ →  │ stickers/        │
│ handler  │   │ handler      │    │ handler          │
│ next()   │   │ next()       │    │ return {}        │
└──────────┘   └──────────────┘    └──────────────────┘
```

```js
// app/handler.server.js
export default async function (event, next) {
    if (next.stepname) return await next();
    return { title: 'Home' };
}
```

```js
// app/products/handler.server.js
export default async function (event, next) {
    if (next.stepname) return await next();
    return { title: 'Products' };
}
```

```js
// app/products/stickers/handler.server.js
export default async function () {
    if (next.stepname) return await next();
    return { title: 'Stickers' };
}
```

* The request enters at the top level (`app/handler.server.js`).
* Each handler may perform logic and either return a response or call `next()`.
* `next()` advances the request to the next directory level in the URL.
* Delegation stops when there are no further segments (`next.stepname` is falsy).


### Internal Rerouting

Beyond the default parent-child flow, a handler can explicitly **reroute** a request to another path within the app by calling `next(path)` or `next(context, path)`.

This is simulated below for a URL like `/products/stickers`.<br>
Here, the root handler conditionally reroutes the request to `/api/inventory`, all within the same app.

```js
// app/handler.server.js
export default async function (event, next) {
    if (next.stepname === 'products') {
        const inventory = await next('/api/inventory?range=7d');
        return { title: 'Products', ...inventory };
    }
    return { title: 'Home' };
}
```

```js
┌──────────┐   ┌──────────────┐    ┌──────────────────┐
│ app/     │─┐ │ products/    │ →  │ stickers/        │
│ handler  │ │ │ handler      │    │ handler          │
│ next(▼)  │ │ │              │    │                  │
└──────────┘ │ └──────────────┘    └──────────────────┘
             │
             │ (internal call)
             ▼
┌──────────┐   ┌──────────────┐    ┌──────────────────┐
│ app/     │ → │ api/         │ →  │ inventory/       │
│ handler  │   │ handler      │    │ handler          │
│ next()   │   │ next()       │    │ return {}        │
└──────────┘   └──────────────┘    └──────────────────┘
```

```js
// app/api/inventory/handler.server.js
export default async function (event, next) {
    const range = event.url.searchParams.get('range');
    const result = await db.query(
        `SELECT * FROM inventory WHERE date_added < $1`,
        [range]
    );
    return { title: 'Inventory', result };
}
```

The rerouted request travels through the normal routing tree (`app/` → `api/` → `inventory/`) as if it had originated normally.

A relative path (e.g., `next('./api/inventory?range=7d')`) may be used to bypass lineage.
But this must be done intentionally: deeper routes often inherit authentication or other contexts that should not be bypassed.

This technique enables **in-app data composition** — using existing route logic without additional network requests.

### Request and Response Rewriting

At any stage, a handler may rewrite parts of a request or modify the returned response before passing it on.
This allows dynamic query shaping, conditional caching, or on-the-fly header injection.

This is simulated below for a scenario where the parent adds a parameter (`p=3`) to the child route, and then post-processes the response to set a custom header.

```js
// app/products/handler.server.js
export default async function (event, next) {
    // Clone the request with a new query param
    const url = new URL(event.url);
    url.searchParams.set('p', 3);

    // Delegate with the modified URL
    const res = await next({}, url.pathname + url.search);

    // Post-process response before returning
    const headers = new Headers(res.headers);
    headers.set('X-Pipeline-Step', 'products');
    return new Response(res.body, { status: res.status, headers });
}
```

```js
┌──────────┐   ┌──────────────┐    ┌──────────────────┐
│ app/     │ → │ products/    │ →  │ stickers/?p=3    │
│ handler  │   │ handler      │    │ handler          │
│ next()   │ ← │ next()       │    │ return {}        │
└──────────┘   └──────────────┘    └──────────────────┘
```

Through this mechanism, Webflo lets handlers **reshape requests or responses inline**, without needing extra middleware layers or global hooks.

## The Client-Server Flow

While the **Delegation Model** describes how a request flows through a _horizontal_ route path (parent → child), the **Client-Server Flow** represents the _vertical_ flow of the same request through the application stack (client → server).

Webflo follows a model that supports request handling and routing at all three layers in this stack: the browser window layer (**client**), the service worker layer (**worker**), the server layer (**server**).

Handlers fit into this stack by their filename suffix:

```html
handler.client.js → Executes in the browser (first to see navigations)
handler.worker.js → Executes in the Service Worker (next in line)
handler.server.js → Executes on the server (last in line)
handler.js        → Executes anywhere (default handler)
```

Together, these form a vertical routing pipeline.

Below is a conceptual diagram of how a navigation request flows donw the layers:

```js
┌─────────────┐   │   ┌─────────────────────────────────┐
│ navigate()  │ → │ ? │ handler.client.js ?? handler.js │
│             │ ← │   └─────────────────────────────────┘
│ app         │   │   ┌─────────────────────────────────┐
└─────────────┘   │ ? │ handler.worker.js ?? handler.js │
                  │   └─────────────────────────────────┘
                  │   ┌─────────────────────────────────┐
                  │ ? │ handler.server.js ?? handler.js │
                  ▼   └─────────────────────────────────┘
```

Handlers are optional; if a level-specific file doesn’t exist, Webflo automatically falls back to the unsuffixed one `handler.js`,
if defined. Otherwise, the request continues to the next layer. Each request gets a graceful path from local logic to remote fulfillment.

As with the horizontal flow, each layer may intercept, fulfill, or delegate down the request.<br>
Handlers at higher layers (like the browser) are able to respond instantly or hand the request down the stack.

This model grants profound flexibility — enabling progressive enhancement, offline support, and universal routing, all through the same `next()` interface.

### Layer Semantics

These layers are differentiated by various factors and use cases.

| Scope                  | Purpose                                        | Typical Usage                               |
| :--------------------- | :--------------------------------------------- | :------------------------------------------ |
| **handler.client.js**  | Runs in the browser during navigation          | SPA transitions, local data hydration       |
| **handler.worker.js**  | Runs in the Service Worker                     | Offline caching, background synchronization |
| **handler.server.js**  | Runs on the server                             | Database queries, SSR, API endpoints        |
| **handler.js**         | Fallback when no scope-specific handler exists | Shared logic or universal defaults          |

#### Client-Side Handlers

Client handlers intercept navigations directly in the browser — the first layer that sees user-initiated requests.

```js
// app/handler.client.js
export default async function (event, next) {
    if (next.stepname) return await next();

    // Access browser APIs freely
    const theme = window.sessionStorage.getItem('theme');
    return { title: 'Client Navigation', theme };
}
```

* Executes during in-app navigations (SPA behavior)
* Runs within the already loaded document and has access to window
* Can render instantly from local data or cache
* Optionally calls `next()` to delegate the request

::: info Handler Lifecycle
- Client handlers begin their lifecycle *after* the initial page load.
- They therefore cannot intercept the first page load or page reloads.
:::

#### Worker-Side Handlers

Worker handlers run in the Service Worker context, bridging offline and network behavior.
They are the connective tissue between local interactivity and remote resources.

```js
// app/handler.worker.js
export default async function (event, next) {
    if (next.stepname) return await next();

    // Access Service Worker APIs
    const cache = await caches.open('webflo-assets');
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const network = await next(); // fallback to server
    cache.put(event.request, network.clone());
    return network;
}
```

* Executes for same-origin requests
* Can serve from cache, perform background syncs, or proxy network calls
* Can delegates to the server when offline handling isn’t possible

::: info Handler Lifecycle
- Worker handlers start intercepting once the app’s Service Worker is installed and activated.
- They therefore cannot intercept the very first page load that installs the app.
- They continue working even when the page isn’t open, making them ideal for offline logic.
:::

#### Server-Side Handlers

Server handlers perform the heavy lifting — database queries, rendering, API endpoints, and integrations.
They represent the final dynamic layer before static content resolution.

```js
// app/handler.server.js
export default async function (event, next) {
    if (next.stepname) return await next();

    const user = process.env.ADMIN_USER;
    const data = await fetch('https://api.example.com/stats').then(r => r.json());
    return { title: `Dashboard | ${user}`, data };
}
```

* Executes for HTTP requests that reach the server
* Accesses environment variables and external APIs
* May call `next()` to handoff request to Webflo’s static file layer

#### Universal Handlers

Universal handlers (`handler.js`) are handlers declared without any layer binding.
They can coexist with layer-specific handlers but execute wherever no layer-specific handler exists for the current layer, making them perfect for universal logic.

```js
// app/handler.js
export default async function (event, next) {
    // Purely portable logic — no window, no caches, no env
    return { message: 'Handled by default' };
}
```

::: tip Progressive Enhancement
- Because handlers are modular by filename, promoting a route from server-side to client-side is as simple as renaming the file.
- Webflo’s model turns *progressive enhancement* into a first-class development workflow.
:::

### Fall-Through Behavior

If a handler calls `next()` and no deeper step exists in the current layer, Webflo **falls through to the next layer** in the stack.
This continuity is built-in.

| Scope      | Default Action when `next()` reaches edge                                                     |
| :--------- | :-----------------------------------------------------                                        |
| **Client** | Falls through to the worker layer.                                                            |
| **Worker** | Falls through to either: (cache → server) or (server → cache), depending on worker config.    |
| **Server** | Falls through to the static file layer `/public`; returns 404 if no match.                    |

This is simulated below for a navigation to `/products/stickers`, where the client and worker layers defer to the server for resolution.

```js
// app/products/handler.client.js
export default async function (event, next) {
    if (next.stepname) return await next();
    // Defer to deeper layers
    return next();
}
```

```html
┌──────────┐   ┌──────────────┐
│ app/     │ → │ products/    │─┐  (fall-through)
│ handler  │   │ handler      │ │
│ next()   │   │ next()       │ │
└──────────┘   └──────────────┘ │
                                │
                                │  (server layer)
                                ▼
┌──────────┐   ┌──────────────┐    ┌──────────────────┐
│ app/     │ → │ products/    │ →  │ stickers/        │
│ handler  │   │ handler      │    │ handler          │
│ next()   │   │ next()       │    │ return {}        │
└──────────┘   └──────────────┘    └──────────────────┘
```

```js
// app/products/stickers/handler.server.js
export default async function () {
    const result = await db.query(
        `SELECT * FROM products WHERE category = 'stickers'`
    );
    return { title: 'Stickers', result };
}
```

Here, the client and worker defer, the server handles the query, and the browser receives the composed response.
This unlocks the full power of composition, progressive enhancement, and resilience per route — whether online, offline, or hybrid.

## Flow Summary

While your first handler is perfectly fine to fit routing logic into conditional blocks,
Webflo's delegation model makes routing all seamsless as you go from a simple _Hello World_ to a standard app, to a fully distributed system.

The delegation and composition model turns the traditional “server-first” web into a **collaborative matrix**.
Each level decides what it can handle best and delegates what it cannot.

This composability and control extend to static files handling.

## Static Files

At the end of Webflo’s routing chain lies the **static layer** — a built-in static file server that operates by the same rules as every other layer.

In Webflo, static resolution is not a separate middleware; it is simply the final stage of the routing pipeline.

This layer is reached **from the server routing layer**, when:

* a server handler calls `next()` and no further route step exists in the pipeline

Because static serving sits in this same flow, route handlers take first-seat complete control — to intercept, rewrite, or even *simulate* static responses before they are served.

This flow is simulated below for an image URL: `/img/logo.png` embedded on a page.<br>
Its resolution goes the standard routing flow until matching a file in the `app/public` directory.

```html
┌─────────────┐   │   ┌─────────────────────────────────┐
│ <img src>   │ → │ ? │ handler.client.js ?? handler.js │
│             │ ← │   └─────────────────────────────────┘
│ app         │   │   ┌─────────────────────────────────┐
└─────────────┘   │ ? │ handler.worker.js ?? handler.js │
                  │   └─────────────────────────────────┘
                  │   ┌─────────────────────────────────┐
                  │ ? │ handler.server.js ?? handler.js │
                  │   └─────────────────────────────────┘
                  │   ┌─────────────────────────────────┐
                  │ ? │ public/img/pic.png              │
                  │   │ public/img/banner.png           │
                  │   │ public/img/logo.png             │
                  ▼   └─────────────────────────────────┘
```

Each handler along the flow gets a chance to intercept the request.<br>
A worker, for example, may serve a cached image or synthesize a response.
A server handler may rewrite the path before handing off to `/public` or it may _gate_ or authenticate the request before passing it on.

This handler-first approach to static files serving ensures that asset delivery fits your application logic, authentication, or cache policies.

But this also requires **proper delegation discipline** by handlers.
Handlers must consciously call `next()` for requests they're not explicitly designed to handle.

Overall, by merging dynamic logic and static delivery into one continuous flow, Webflo replaces special-case asset middleware with a **first-class, programmable static pipeline**.

### Default Resolution

When a request reaches the static layer, Webflo performs deterministic file resolution:

1. Look for a file in `/public` matching the request path.
2. If found, serve it with correct headers (e.g. `Content-Type`, `Content-Length`, caching).
3. If not found, return `404`.

## Use Case Patterns

The following examples demonstrate how Webflo’s routing primitives—delegation, composition, and explicit fall-through—combine to express real application structures.
Each pattern is an applied scenario that builds directly on the models we’ve covered so far.

### Parent–Child Composition

**Scenario:** A parent route prepares context and then delegates to a child, merging its result.
This pattern allows *layered composition*—logic in parents, data or view in children.

```js
// app/handler.server.js
export default async function (event, context, next) {
    if (next.stepname) {
        const user = await getSessionUser(event.request);
        const childResult = await next({ user });
        return { ...childResult, title: `${childResult.title} | ExampleApp` };
    }
    return { title: 'Home' };
}
```

**Takeaway:** Each handler can frame or extend downstream results, making cross-cutting concerns like authentication or analytics fully composable.

### Internal API Consumption

**Scenario:** A page handler calls an internal API route using `next(path)` instead of making an HTTP request.
This lets server code reuse API logic without duplication or latency.

```html
app/
├── api/
│   └── products/handler.server.js
└── shop/handler.server.js
```

```js
// app/shop/handler.server.js
export default async function (event, next) {
    const products = await next('/api/products');
    return { title: 'Shop', ...products };
}
```

**Takeaway:** By re-entering the routing pipeline locally, Webflo turns API composition into simple function calls—no network, no boilerplate.

### Auth Guard

**Scenario:** A parent route gates access for its children, redirecting unauthenticated users and passing context when authorized.

```js
// app/account/handler.server.js
export default async function (event, context, next) {
    const user = await getUserFromSession(event.request);
    if (!user) {
        return new Response(null, { status: 302, headers: { Location: '/login' } });
    }
    return next({ ...context, user });
}
```

**Takeaway:** Authentication becomes just another layer in the routing flow—no external middleware required.

### File Guards and Access Control

**Scenario:** Restrict access to premium or user-specific files before they reach the static layer.

```js
// app/files/handler.server.js
export default async function (event, next) {
    const user = await getUserFromSession(event.request);
    if (!user?.isPremium) {
        return new Response('Access denied', { status: 403 });
    }
    return next();
}
```

**Takeaway:** Because static requests flow through the same pipeline, permission checks and audit logic integrate naturally with asset delivery.

### Dynamic File Serving

**Scenario:** Rewrite or transform static responses on the fly for caching, personalization, or instrumentation.

```js
// app/-/handler.server.js
export default async function (event, next) {
    const res = await next(); // delegate to /public
    if (res && res.ok && res.headers.get('Content-Type')?.includes('text/html')) {
        const headers = new Headers(res.headers);
        headers.set('Cache-Control', 'public, max-age=300');
        headers.set('X-Served-By', 'Webflo');
        return new Response(res.body, { status: res.status, headers });
    }
    return res;
}
```

**Takeaway:** Handlers can shape even static responses—embedding application-level awareness into the file server itself.

### Full-Stack Routing

**Scenario:** A single navigation passes through multiple layers—client, worker, server, static—each adding incremental behavior.

```js
CLIENT (handler.client.js)
    │   Intercepted navigation, local cache check
    ▼   next()
WORKER (handler.worker.js)
    │   Offline fallback or cache refresh
    ▼   next()
SERVER (handler.server.js)
    │   Query, render, compose
    ▼   next()
STATIC (public/)
    │   Fallback to static asset
    ▼
  Response returned
```

```js
// app/products/handler.client.js
export default async function (event, next) {
    if (next.stepname) return await next();
    // Attempt to serve from local state
    const cached = sessionStorage.getItem('products');
    if (cached) return JSON.parse(cached);
    return next(); // defer to worker/server
}
```

**Takeaway:** Full-stack routing enables progressive enhancement by design—each scope adds value without breaking continuity.

### Remote Procedure Calls Clone

**Scenario:** Think of Webflo’s routing pipeline as RPC with spatial awareness.
Each `next()` is a local procedure call that moves closer to the data or resource in question.

```js
// app/dashboard/handler.server.js
export default async function (event, next) {
    const metrics = await next('/api/metrics');
    const reports = await next('/api/reports');
    return { metrics, reports };
}
```

**Takeaway:** Unlike traditional RPC, routing in Webflo preserves URL semantics and context propagation while keeping the call local and synchronous.

## Summary

Webflo’s routing system unifies **filesystem mapping**, **functional composition**, and **layered execution** into one consistent model.

* The filesystem defines your application structure.
* Handlers define logic for each URL segment.
* `next()` controls flow between steps and scopes.
* Default fallbacks ensure graceful completion through the stack.
* Static serving is part of the same flow, enabling dynamic control.

## Next Steps

* [Rendering](./rendering.md): How handler data becomes UI.
* [Templates](./templates.md): Composing reusable HTML layouts.
* [State & Reactivity](./state.md): Managing state and mutation across requests.
