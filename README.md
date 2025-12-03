# Webflo – _A next-gen, web-native framework_

[![npm version][npm-version-src]][npm-version-href]<!--[![npm downloads][npm-downloads-src]][npm-downloads-href]-->
[![License][license-src]][license-href]

_Build the full spectrum of modern applications — backends, frontends, offline-first, and realtime apps — on raw platform power._ 🛸<br>
[Webflo ↗](https://webflo.netlify.app/overview) is a web-native framework that lets you build absurdlly fast — with the whole sophistication and scale of modern apps solved from the foundation up.

---

> [!IMPORTANT]
> 🚀 **Webflo is in active development and evolving daily.** Current status = **alpha**.<br>
> You’re welcome to experiment, but it’s not yet suited for production apps.

---

## Getting Started

For a quick intro, see the docs:

+ [Getting Started ↗](https://webflo.netlify.app/docs/getting-started)
+ [Core Concepts ↗](https://webflo.netlify.app/docs/concepts)
+ [Examples ↗](https://webflo.netlify.app/examples)

---

## What You Can Build

| Category                   | Examples & Notes                                                                                                 |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Web apps**               | Anything from classic MPAs to rich SPAs – with SSR/CSR/hybrid rendering patterns.                                |
| **API backends**           | REST endpoints and webhooks – with streaming, partial responses, and live messaging.                             |
| **Static sites**           | Static-first or fully pre-rendered sites – with the same client-side richness of a Webflo app.                    |
| **Mobile experiences**     | Installable, offline-capable PWAs – with background sync, push notifications, and more.                           |
| **Realtime & multiplayer** | Chats, presence, dashboards, live docs, notifications – realtime channels and dialogs available out of the box.   |
| **AI & agents**            | Multi-step AI workflows, background agents, and automation – powered by Webflo’s realtime capabilities.           |

---

## Features

| Feature                               | Description                                                                                         |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| 📁 **Folder-based routing**           | Filesystem routing across client, service worker, and server layers.                                 |
| 🌍 **Service Worker routing**         | Support for route handlers in the service worker.                                                   |
| 🔐 **Sessions & auth**                | Built-in cookie handling, session utilities, and helpers for gated routes and user-aware flows.     |
| ⚡ **Realtime capabilities**           | Live responses, mutable/differential responses, two-way background messaging — all built in.       |
| 🧠 **Mutation-based reactivity**       | State is plain objects and arrays; mutations drive reactivity via the Observer API.                 |
| 🧱 **OOHTML integration**              | HTML-native templates, imports, and composition without a component DSL or build-heavy toolchain.   |
| 🧩 **Dev mode & HMR**                 | Fast development server with fine-grained rebuilds and hot updates for HTML, JS, and CSS.           |

---

## Contributing

Webflo is in active development — and contributions are welcome!  

Here’s how you can jump in:  
- **Issues** → Spot a bug or have a feature idea? Open an [issue](https://github.com/webqit/webflo/issues).  
- **Pull requests** → PRs are welcome for fixes, docs, or new ideas.  
- **Discussions** → Not sure where your idea fits? Start a [discussion](https://github.com/webqit/webflo/discussions).  

### 🛠️ Local Setup

⤷ clone → install → test

```bash
git clone https://github.com/webqit/webflo.git
cd webflo
git checkout next
npm install
npm test
```

### 📝 Tips

- Development happens on the `next` branch — be sure to switch to it as above after cloning.
- Consider creating your feature branch from `next` before making changes (e.g. `git checkout -b feature/my-idea`).
- Remember to `npm test` before submitting a PR.

## 🔑 License

MIT — see [LICENSE](https://github.com/webqit/webflo/blob/master/LICENSE)

[npm-version-src]: https://img.shields.io/npm/v/@webqit/webflo?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/@webqit/webflo
[npm-downloads-src]: https://img.shields.io/npm/dm/@webqit/webflo?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/@webqit/webflo
[license-src]: https://img.shields.io/github/license/webqit/webflo.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/webqit/webflo/blob/master/LICENSE
