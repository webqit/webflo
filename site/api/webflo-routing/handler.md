# Handler API

Handlers are the entry point for all requests in Webflo. This page documents the formal contract for handler functions.

## Signature

```js
export default async function(event, next, fetch) { /* ... */ }
```

## Naming

A route may provide named exports to map specific HTTP requests to specific handlers:

```js
export async function GET(event, next, fetch) { /* ... */ }
export async function POST(event, next, fetch) { /* ... */ }
// PUT, PATCH, DELETE, OPTIONS, HEAD are also supported
```

| Name      | Description                                  |
| :-------- | :------------------------------------------- |
| `GET`     | Handle HTTP GET requests                      |
| `POST`    | Handle HTTP POST requests                     |
| `PUT`     | Handle HTTP PUT requests                      |
| `PATCH`   | Handle HTTP PATCH requests                    |
| `DELETE`  | Handle HTTP DELETE requests                   |
| `OPTIONS` | Handle HTTP OPTIONS requests                  |
| `HEAD`    | Handle HTTP HEAD requests                     |

If a named export is not provided for an incoming method, Webflo falls back to the `default` export, if present.

## Parameters

| Parameter | Type                                                | Description                                              |
| :-------- | :-------------------------------------------------- | :------------------------------------------------------- |
| `event`   | [`HttpEvent`](/api/webflo-routing/HttpEvent)        | Current HTTP event.                                      |
| `next`    | [`next`](/api/webflo-routing/handler/next)          | Control delegation function.                             |
| `fetch`   | [`fetch`](/api/webflo-routing/handler/fetch)        | Context-aware fetch API for inbound and outbound calls.  |

## The `this` Context

Contextual properties are available on the `this` context:

| Property        | Type       | Description                                                       |
| :-------------- | :--------- | :---------------------------------------------------------------- |
| `this.stepname` | `string`   | The current directory segment being handled.                      |
| `this.pathname` | `string`   | The current URL pathname up to the active step.                   |
| `this.filename` | `string`   | The filename of the executing handler (server-side only).         |

::: info See also
[`next`](/api/webflo-routing/handler/next#properties)
:::

## Return Types

Handlers can return one of the following:

| Type            | Description |
| :-------------- | :---------- |
| Plain value     | A JSON-serializable value or plain object used as the page's data binding. |
| `Response`      | A standard Web Fetch API `Response`. |
| `LiveResponse`  | A streaming/live response that can emit multiple payloads over time. |

## Return Styles

You can deliver values in two ways:

| Style                  | When to use |
| :--------------------- | :---------- |
| `return`               | Return a single value (`object`, `Response`, or `LiveResponse`). |
| `event.respondWith()`  | Emit one or more responses, including progressive/streamed updates. See [/docs/concepts/realtime](/docs/concepts/realtime). |

### `event.respondWith()` forms

- `event.respondWith(data)` — immediately deliver `data`.
- `event.respondWith(data, { done: false })` — deliver `data` and keep the channel open for more.
- `event.respondWith(data, (proxy) => { /* write to proxy */ })` — low-level streaming; complete when callback resolves or another `respondWith` is called.

## Generator and Live Functions

Handlers may be expressed as generators or "live" functions to naturally produce multiple values over time.

- Generator: `export function* GET(event) { yield {...}; return {...}; }`
- Live function: `export live function GET(event) { return {...} }`  
See [/docs/concepts/realtime](/docs/concepts/realtime) for details.

## Lifecycle

- Streams, generators, and live functions end when `HttpEvent.signal` aborts.
- The root `HttpEvent` is aborted when all handlers in the subtree complete, the request is aborted, or realtime closes.

## Examples

Return plain data (rendered into templates via `document.bindings.data`):

```js
export async function GET(event) {
  return { title: 'Hello', greeting: 'Hello World!' };
}
```

Return a `Response`:

```js
export async function GET() {
  return Response.json({ ok: true });
}
```

Progressively stream values:

```js
export async function GET(event) {
  event.respondWith({ step: 1 }, { done: false });
  await new Promise(r => setTimeout(r, 200));
  event.respondWith({ step: 2 }); // done by default
}
```