# State, Mutation, & Reactivity

Webflo’s approach to state is refreshingly simple: your UI state is just a plain JavaScript object. When your server handler returns data, it becomes available as `document.bindings.data` for your templates and UI. No special syntax, no framework-specific magic—just JavaScript you already know.

## How State Flows

When a request comes in:
1. Your handler fetches or computes data.
2. That data is returned in the response.
3. Webflo assigns it to `document.bindings.data` on the client.
4. Your templates and UI render based on this state.

```js
// In your handler
return new Response(renderToHtml({ todos: ["Buy milk", "Read docs"] }));

// In the browser
console.log(document.bindings.data.todos); // ["Buy milk", "Read docs"]
```

## Reactivity with the Observer API

Want your UI to update automatically when state changes? Webflo’s Observer API lets you observe mutations on your state object and react to them—no new syntax or learning curve required.

```js
Observer(document.bindings.data, () => {
  // This runs whenever data changes
  renderUI();
});

document.bindings.data.todos.push("Write code"); // UI updates!
```

> **Why it matters:** This “back to basics” approach means you can use all your JavaScript skills, with reactivity as an opt-in superpower. No hidden magic—just objects and events.

## When to Use Observer
- For live-updating UI (counters, lists, dashboards)
- For collaborative or realtime features
- For any case where you want the UI to reflect state changes instantly

## Learn More
- [Rendering](./rendering.md)
- [Realtime](./realtime.md)
- [API: Observer](../api/observer.md)
