# Handler::`fetch()`

Make inbound or outbound calls.

## Signature

```js
// url can be string or URL
// url can be relative when string
// init can be Request instance or Request init
await fetch(url, init?);
await fetch(request);
```

## Arguments

| Argument          | Tyoe          | Default       | Description                   |
| :---------------- | :------------ | :------------ | :---------------------------- |

## Return Value

If relative, behaves and returns as [`next()`](next):

| Condition                                  | Return type                   |
| :----------------------------------------- | :---------------------------- |
| Step handler is generator function         | `Generator` object            |
| Step handler is Quantum function           | `State` object                |
| Step handler uses `event.respondWith()`    | `LiveResponse`                |
| Step handler returns `LiveResponse`        | `LiveResponse`                |
| Step handler returns `Response`            | `Response`                    |
| Step handler returns any other value.      | That value                    |

Otherwise, behaves and returns as standard `fetch()`.

## Differences from `next()`:

intro

| `next()`                                   | `fetch()`                                |
| :----------------------------------------- | :--------------------------------------- |
| Makes only inbound calls.                  | Can make both inbound or outbound calls. |
| Inherits current request.                  |                                          |
