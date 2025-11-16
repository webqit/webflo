# HTTP Event

The `event` object represents the request and provides access to all request data, state, and lifecycle helpers.

## Properties
- `event.request`: Standard Request object
- `event.url`: Enhanced URL object
- `event.cookies`, `event.session`, `event.user`: State interfaces
- `event.client`: Realtime messaging
- `event.signal`: AbortSignal
- `event.state`, `event.detail`, `event.sdk`

## Methods
- `event.waitUntil(promise)`
- [`event.respondWith(data, ...)`](./HttpEvent/respondWith)
- `event.clone(init)` / `event.extend(init)`
- `event.abort()`
- `event.poll(callback, opts)`
- `event.lifeCycleComplete([promise])`

See [Lifecycle](/docs/concepts/lifecycle) for context and [Realtime](/docs/concepts/realtime) for live updates.

## Lifecycle

+ HttpEvent.signal aborts when
    + parent event's signal aborts
    + request's signal aborts
    + HttpEvent.abort() is called
    + handler returns, plus all handlers in subtree return; i.e. all handlers complete their lifecycle
+ root HttpEvent is aborted on any of the above or when Realtime closes
