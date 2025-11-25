# Handler::`next()` (Page Coming Soon)

Delegate to next step or make inbound calls.

## Signature

```js
await next();
// url can be string or URL
// url can be relative when string
// init can be Request instance or Request init
await next(url, init?);
await next(request);
await next({ redirect?: url = next.pathname, with?: init });
```

## Arguments

| Argument          | Tyoe          | Default       | Description                   |
| :---------------- | :------------ | :------------ | :---------------------------- |

## Properties

| Property        | Type            | Description                                                       |
| :-------------- | :-------------- | ----------------------------------------------------------------- |
| `next.stepname` | `string`        | The name of the next segment in the URL.                          |
| `next.pathname` | `string`        | The full path _beyond_ the the active step.                       |


::: info See Also
[`this`](../handler#the-this-context)
:::

## Return Value

Depends on the step handler's return value. If:

| Condition                                  | Return type                   |
| :----------------------------------------- | :---------------------------- |
| Step handler is generator function         | `Generator` object            |
| Step handler is Quantum function           | `State` object                |
| Step handler uses `event.respondWith()`    | `LiveResponse`                |
| Step handler returns `LiveResponse`        | `LiveResponse`                |
| Step handler returns `Response`            | `Response`                    |
| Step handler returns any other value.      | That value                    |

## Differences from `fetch()`:

intro

| `next()`                                   | `fetch()`                                |
| :----------------------------------------- | :--------------------------------------- |
| Makes only inbound calls.                  | Can make both inbound or outbound calls. |
| Inherits current request.                  |                                          |
