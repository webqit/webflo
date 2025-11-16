# Webflo <br>— A Web-Native Framework for the Next Gen

_Build the full spectrum of modern apps — backends, frontends, offline-first, and realtime apps — on raw platform power._

Welcome to the docs.

## What is Webflo

Webflo is a web-native framework that lets you build backends, frontends, offline-first, and realtime apps absurdly fast.

"Web-native." The cheatcode, if you caught it.<br>
Just programming fundamentals and raw platform power, shipped in a framework.
Modern apps — their sophistication and scale — solved from the foundation up.

## Why Webflo

Webflo shares the same broad use cases as traditional frameworks, but it is designed on an entirely different premise:
**walk the traditional framework ladder back to programming fundamentals and sheer platform capabilities** — not merely to align with web standards, **but to put the foundations to work in new ways**. From JavaScript to HTML, to the web's transport layer, we took existing fundamentals and built new ones — to give developers less machinery, more leverage.

**An engineer’s tour…**

### Mutation-Based Reactivity

At the foundation is an all-new reactive model: **mutation-based reactivity**, powered by the [Observer API](/docs/tech-stack#the-observer-api). With this model, Webflo anchors itself on JavaScript’s direct mutation semantics and makes it its own engine of reactivity across the whole stack — server, worker, and client. Reactivity just works as program state changes.
This means:

* **State is just objects and arrays**. With reactivity solved at the object level, no need for stores, hooks, signals, proxies, reducers, or container types. The object you see _is_ the state.
* **Mutation becomes the shared language of reactivity across the system** — whether on the server, the service worker, or the UI.
* **With no layers of indirection, mental model stays simple**. At any given time, you're simply either making mutations or observing mutations — exactly as you would without any framework.

This enables **a new generation of apps that entirely avoid the traditional state scaffolding and the inherent cost of forbidding mutability in a mutable world as JavaScript**.

### Realtime Over HTTP

Webflo extends the HTTP request/response model with realtime capabilities that let request handlers opt into an interactive, realtime channel with the client — exposed as `event.client`. Webflo automatically upgrades the underlying transport and manages the request lifecycle.
You get a capable transport layer that can be used for many things. Webflo builds on that to enable:

+ **A multi-stage response model via `LiveResponse`**. Send multiple responses at different stages of request processing: `liveResponse.replaceWith()`, `event.respondWith()`, etc. Clients swap state and rerender accordingly.
+ **Differential, live state over the wire**. Share live state with the client and mutate it in place as you deem fit: `Observer.set(liveResponse.body, name, value)`, `Observer.proxy(liveResponse.body.items).push(item)`, etc. Clients preserve state and reflect diffs. Application state goes fullstack.
+ **Interactive request handling**. Pause request processing to interact with the user as the need may arise: `event.user.confirm()`, `event.user.prompt()`, etc. Clients initiate the corresponding dialog with the user and reply.

Together with the `event.client` API itself, you get a unified surface for many different realtime apps — collaboration, multi-device presence, multiplayer, streaming progress, and more — with no extra wiring or protocols.

### HTML for the Modern UI

Webflo brings HTML into the application authoring equation as its direct UI language — instead of as compile target. It converges on a design that leaves the UI layer entirely in HTML terms — and upgrades the authoring experience via first-class integration with [Object-Oriented HTML (OOHTML)](/docs/tech-stack#oohtml). OOHTML extends HTML with capabilities like **modularity & reusability**, **reactivity & data binding** — **without a build step**. You get:

* **Modular imports and composable templates** (`<template def>` and `<import ref>`) as first-class primitives.
* **Scoped styles and scripts, and even scoped subtrees** without Shadow DOM complexity (`<script scoped>`, `<style scoped>`, `<div namespace>`).
* **Reactive bindings without a compile step** — via HTML attributes and HTML comment (`<!--{ title }-->`, `<?{ title }?>`).

This solves for the sophistication of modern UIs in just HTML, without the complexity of a compile step. With that out of the way, you get **edit-in-browser workflows** where the UI directly reflects live DOM manipulation via the browser inspector.

### The Service Worker as an Embedded Edge Runtime

Webflo brings the service worker into the application model as a full routing runtime — extending it beyond its traditional role as a cache script or network proxy.
The shift lets you bring your application routes into the service worker, with the same routing architecture and request-handling capabilities as the server and client runtimes. This unlocks:

* **Fullstack routing**. Distribute route handlers across, not two, but three runtimes (server, worker, client) as you deem fit. Same routing architecture, same request-handling capabilities.
* **More performant client-side routing**. Move compute-intensive routing logic into the service worker runtime from the main thread to keep the UI responsive.
* **Route-based background tasks**. Sync, periodic events, and push notifications map into routes naturally, not into separate worker-only APIs. One routing architecture for many use cases.

The service worker as a new routing site exposes this underutilized layer of the platform as a _standard application surface to build on_ — like an embedded edge runtime — taking the application closer to the heart of the platform’s capabilities than traditional architectures allow.

---

**What this means**: Webflo is an orchestration of programming fundamentals, web platform capabilities, and the web’s communication protocols into an application framework for the next generation of web apps. With just the fundamentals as the entire application stack — _and no extra thing "going on"_ — Webflo achieves a rare level of conceptual and operational simplicity that makes the sophistication of modern apps feel _almost_ trivial.

## What You Can Build

| Category                   | Examples & Notes                                                                                                 |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Web apps**               | From classic MPAs to rich SPAs, hybrid SSR/CSR experiences, and full PWAs — all built on one unified framework. |
| **API backends**           | REST endpoints, serverless-style handlers, and webhooks with streaming, partial responses, and live messaging.   |
| **Static sites**           | Static-first or fully pre-rendered sites that seamlessly upgrade sections to live or interactive behavior.        |
| **Mobile experiences**     | Installable, offline-capable PWAs with background sync, worker routing, and native-feeling navigation.            |
| **Realtime & multiplayer** | Chats, presence, dashboards, live docs, notifications — realtime channels and dialogs available out of the box.  |
| **AI & agents**            | Multi-step AI workflows, background agents, and automation powered by Webflo’s live request lifecycle.           |

## Features

| Feature                               | Description                                                                                         |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| 📁 **Folder-based routing**           | Filesystem routing across client, worker, and server layers, with seamless interception and flow.   |
| 🌍 **Full-stack routing & lifecycle** | Every request flows through browser, worker, and server layers using the same handler model.         |
| 🔗 **Internal API composition**        | Reuse your own routes as local function calls via `next(path)` — no extra networking required.       |
| 🔐 **Sessions & auth**                | Built-in cookie handling, session utilities, and helpers for gated routes and user-aware flows.     |
| ⚡ **Realtime capabilities**           | Live responses, incremental updates, dialogs, and background channels — no explicit WebSocket setup. |
| 🧠 **Mutation-based reactivity**       | State is plain objects and arrays; mutations drive reactivity via the Observer API.                 |
| 🧱 **OOHTML integration**              | HTML-native templates, imports, and composition without a component DSL or build-heavy toolchain.   |
| 📦 **Offline & worker features**       | Worker-side routing, caching, background sync, and offline-first behaviors built in.                |
| 🧩 **Dev mode & HMR**                 | Fast development server with fine-grained rebuilds and hot updates for HTML, JS, and CSS.           |

## Get Started

| Path                                         | Focus                                                             |
| :------------------------------------------- | :---------------------------------------------------------------- |
| [Getting Started](./docs/getting-started) | Your first route and page in minutes.                             |
| [Core Concepts](./docs/concepts)          | The mental models behind routing, request/response, and realtime. |
| [Examples](./examples)                    | Small, focused examples.                                          |
