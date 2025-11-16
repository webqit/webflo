# Recipe: Streaming

Send progressive updates.

```js
export async function GET(event) {
  event.respondWith({ step: 1 }, { done: false });
  await new Promise(r => setTimeout(r, 100));
  event.respondWith({ step: 2 }); // done
}
```

See:
- [Handler → Return Styles](/api/webflo-routing/handler#return-styles)
- [Request/Response](/docs/concepts/request-response)
