<div align="center">

# Webflo  

_A web-native framework for the next generation of apps_

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

</div>

<div align="center">

_Build the full spectrum of modern applications — backends, frontends, offline-first, and realtime apps — on raw platform power._ 🛸<br>
[Webflo ↗](https://webflo.netlify.app/docs) is a web-native framework that lets you build absurdlly fast — with the whole sophistication and scale of modern apps solved from the foundation up.

</div>

---

> [!IMPORTANT]
> 🚀 **Webflo is in active development and evolving daily.** Current status = **alpha**.<br>
> You’re welcome to experiment, but it’s not yet suited for production workloads.

---

## Getting Started

For a quick intro, see the docs:

+ [Getting Started ↗](https://webflo.netlify.app/docs/getting-started)
+ [Core Concepts ↗](https://webflo.netlify.app/docs/concepts)
+ [Examples ↗](https://webflo.netlify.app/examples)

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
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@webqit/webflo?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=@webqit/webflo
[license-src]: https://img.shields.io/github/license/webqit/webflo.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/webqit/webflo/blob/master/LICENSE
