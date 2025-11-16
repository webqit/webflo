# The Technology Stack

This part covers the technologies that make up the Webflo stack.

## Platform APIs

Webflo is *deeply* integrated with how the web already works. It leans on standard web platform APIs so your code stays portable and predictable. Key platform APIs used by Webflo include:

| Feature | Why it matters | Link |
|:---|:---|:---|
| Request | Network primitive for making outgoing requests. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Request) |
| Response | Representation of responses returned from network requests. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Response) |
| Headers | Structured metadata for requests and responses. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Headers) |
| Streams | Enables streaming bodies for incremental rendering and transfer. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) |
| URL | Robust URL parsing for canonicalization and routing. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL) |
| URLPattern | Route pattern matching for routing logic. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) |
| DOM | Native markup primitives for composing and rendering UI. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model) |
| \<template\> element | Reusable template primitive for composition and SSR/CSR. | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) |
| ReadableStream | Incremental consumption of streaming data. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) |
| WritableStream | Incremental production of streaming data. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream) |
| Service Worker API | Background routing, caching, and offline capabilities. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) |
| MessageChannel | Bidirectional messaging for realtime/background features. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) |
| FormData | Native type for multipart form uploads and form handling. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FormData) |
| Blob | Binary data container for transfers and file blobs. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Blob) |
| File | Represents filesystem-backed file uploads. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/File) |

## The Observer API

Reactivity in Webflo is powered by the [Observer API](https://github.com/webqit/observer)
 — a lightweight, general-purpose API for observing JavaScript objects and arrays.

With the Observer API unlocking observability at the object and array level, no special interfaces or wrappers are needed for reactivity anywhere in the stack. Webflo simply runs on bare objects, bare arrays, and the concept of mutation — all plain JavaScript primitives. For a framework, this sets a new benchmark in _just using the language_ — one we intend to preserve.

As a developer, you get a clean technology stack that's all just plain objects and arrays too - stripped of special programming interfaces like WebfloStore, WebfloReduxAdapter, WebfloReactiveProxyThingAdapter, etc. Often these exist in other frameworks as a means to reactivity, guarded with measures against mutability since that breaks their reactive model.

By making mutation a first-class concept, as it is in JavaScript itself, Webflo helps you see the world as it is — dynamic, mutable, powerful, free.

Meet the [Observer API →](https://github.com/webqit/observer)

## OOHTML

OOHTML is the lightweight, buildless markup layer Webflo uses for composing UI. Its role in the stack is simple and decisive: make HTML modular, importable, and data-aware so authors can ship interactive apps without a heavy toolchain.

How it simplifies everything:
- Buildless composition: authors write plain HTML (templates + imports) instead of compiling a new component language — fewer build steps, fewer surprises.
- Portable markup: the same template files work for SSR and CSR, so your UI source is the single truth.
- Low cognitive load: conventional HTML authoring, with a few additive conventions (imports, `def`/`ref`, scoped styles/scripts) instead of an entire framework DSL.
- First-class data plumbing: OOHTML directly binds to your app's `document.bindings` and the Observer API for hydration and reactive updates.

What OOHTML gives you (at a glance):
- Declarative HTML imports and modular templates — reuse without build tooling.
- Namespacing, and style and script scoping to avoid global collisions.
- Comment-based and inline data binding that degrades cleanly in SSR.
- Imperative import APIs for dynamic or lazy module loading.

Meet [OOHTML →](https://github.com/webqit/oohtml)