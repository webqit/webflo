# Requests & Responses

This page explains how Webflo orchestrates each interaction from request to response, and how you can hook into various stages, including realtime.

## Overview
1. A request is received and a route is resolved.
2. Matching handler(s) execute, optionally delegating via `next()` for nested routes.
3. A value is produced: data, `Response`, or `LiveResponse`.
4. The client renders data into the UI or consumes the response stream.
5. Optional realtime keeps the channel open for additional updates until closed.

## The HttpEvent
- `event.request`, `event.url` — normalized request data.
- `event.cookies`, `event.session`, `event.user` — common state interfaces.
- `event.signal` — aborts when lifecycle completes or client aborts.
- `event.waitUntil(promise)` — extend lifecycle to await background work.
- `event.respondWith(value, optionsOrCallback)` — emit one or more responses.

See also: [/api/webflo-routing/HttpEvent](/api/webflo-routing/HttpEvent)

## Delegation via next()
```js
export default async function (event, next) {
  if (next.stepname) return next();
  return { title: 'Home' };
}
```

## Returning Values
- Single value: `return {...}` or `return Response.json({...})`
- Multiple/progressive values: call `event.respondWith(...)` one or more times
- Generators or live functions can yield multiple values naturally

See: [/api/webflo-routing/handler](/api/webflo-routing/handler)

## Realtime
Realtime extends the lifecycle beyond a single response so server and client can exchange multiple messages.

Close conditions:
- Handler finishes and no more messages are expected
- `HttpEvent.signal` aborts (client navigated away or server closed)

See: [/docs/concepts/realtime](/docs/concepts/realtime)

## Completion and Abort
- The root event aborts when all subtree handlers complete or the request aborts.
- Child events inherit from the parent and abort when the parent aborts.
