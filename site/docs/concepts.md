

# Core Concepts

Welcome to the heart of Webflo. If you’ve ever wondered how modern web apps can feel so seamless—navigating between pages without reloads, updating in real time, and blending server and client logic—this is where the magic happens.

This page is your map to the core ideas that power every Webflo app. We’ll walk through the big concepts, show you how they fit together, and help you build the mental models you’ll need to create robust, maintainable, and delightful web experiences.

## Routing: How URLs Map to App Structure

Routing in Webflo is filesystem-based. Add a folder in the `app/` directory, and you’ve added a route. Each folder maps to a segment in your application’s URL structure; each with route handlers that run either server-side, client-side, or even service-worker-side. Webflo lets all these routes talk to each other to handle an incoming request.

**How it works:**
- `/` → `app/handler.server.js`
- `/about` → `app/about/handler.server.js`
- `/api/hello` → `app/api/hello/handler.server.js`

We'll meet this in [Routing →](./concepts/routing.md)

## Rendering: How Data Becomes UI

Rendering turns handler responses into visible UI. In Webflo, data from each request is automatically bound to the document — exposed at `document.bindings.data`, and automatically reflected in the UI. The flow goes as:<br>handler → data → `document.bindings.data` → UI<br> — whether rendering on the server or the client.

**How it works:**
- Handler returns data: `return { title, greeting };`
- You find it in the page at: `document.bindings.data`
- UI binds to it declaratively: `<h1><?{ data.greeting }?></h1>`
- It's rendered: `<h1>Hello!</h1>`

We'll meet this in [Rendering →](./concepts/rendering.md)

## Templates: Reusable HTML, Modern Standards

Templates come into play when you move beyond a single HTML file (`public/index.html`) to a dynamically composed UI. They’re just standard HTML templates — extended _just enough_ for data binding and composition. You define reusable markup via `<template def>`; you reuse anywhere via `<import ref>`. These form the building blocks of Webflo’s dynamic UI.

**How it works:**

- You define markup once and reuse everywhere.

```html
<template def="temp">
    <h1><?{ data.greeting }?></h1>
</template>
```
```html
<import ref="temp"></import>
```

We'll meet this in [Templates →](./concepts/templates.md)

## State, Mutation, & Reactivity: Webflo's First-Class Support for Mutation-Based Reactivity

Reactivity is intrinsic to Webflo — and the magic is no magic at all.<br>
Global state in a Webflo app lives at `document.bindings`. It's a *plain* JavaScript object that invites direct mutation — just like any object. The different parts of the app — including the UI — observe those mutations via the [Observer](https://github.com/webqit/observer) API. Everyone reacts as state changes.

**How it works:**
- `document.bindings` serves as the app’s central state
- The UI and other parts of the app bind to it
- State updates — either through direct mutation or in response to navigation events
- Mutation triggers reactivity across the app

We'll meet this in [State & Reactivity →](./concepts/state.md)

## Request/Response Lifecycle: The Web’s Communication Model

Every interaction on the web is a conversation: a request goes out, a response comes back, and the UI updates. Webflo lets you hook into every stage of that conversation — from interception to streaming — so you can orchestrate logic across the full lifecycle.

**How it works:**
- The browser sends a request to the server.
- The server responds with data (and/or HTML).
- The browser renders the UI based on the response.

We'll meet this in [Request/Response Lifecycle →](./concepts/lifecycle.md)

## Realtime: Keeping Everyone in Sync

Most apps need to stay live, connected, and consistent across all clients. Webflo apps work that way out of the box — via background messaging. A route handler can opt into background mode where it keeps a two-way communication channel with the client. Webflo keeps this connection open until the conversation is complete — extending the request/response lifecycle into a realtime stream. App works in realtime, with zero wiring.

**How it works:**
- Route handler receives a request and opts into background communication
- Webflo extends the connection into a realtime, two-way channel.
- Handler and client stay in sync; app works live.

We'll meet this in [Realtime features →](./concepts/realtime.md)

## Next Steps

You’ve just walked through Webflo’s conceptual arc — from **Routing → UI → State → Continuity**.

Next is to explore each concept in detail, in the same order. Together they form the foundation for everything you’ll build with Webflo.

* [Routing](./concepts/routing.md): How URLs map to your app’s logic and structure.
* [Rendering](./concepts/rendering.md): How data becomes interactive UI.
* [Templates](./concepts/templates.md): How markup becomes composable and reusable.
* [State & Reactivity](./concepts/state.md): How mutation and reactivity unify server and client.
* [Request/Response Lifecycle](./concepts/lifecycle.md): How every interaction flows through Webflo.
* [Realtime](./concepts/realtime.md): How the cycle extends into continuous connection.
