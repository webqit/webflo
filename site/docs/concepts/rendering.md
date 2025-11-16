# Rendering

Rendering in Webflo is about turning handler data into UI, both on the server (SSR) and in the browser (CSR).

## The Mental Model

- Your handler returns data (a plain object or Response).
- Webflo makes this data available as `document.bindings.data` in your HTML.
- Rendering can happen on the server, the client, or both—using the same mental model.

## Example: Returning Data

```js
// app/handler.server.js
export default async function(event, next) {
  if (next.stepname) return await next();
  return { title: 'Home', greeting: 'Hello World!' };
}
```

## Accessing Data in HTML

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
    <script>
      setTimeout(() => {
        document.title = document.bindings.data.title;
      }, 0);
    </script>
  </head>
  <body>
    <h1 id="greeting"></h1>
    <script>
      setTimeout(() => {
        document.getElementById('greeting').textContent = document.bindings.data.greeting;
      }, 0);
    </script>
  </body>
</html>
```

## SSR & CSR

- **SSR:** Data is rendered into HTML on the server for fast first paint and SEO.
- **CSR:** Data is updated in the browser for dynamic, interactive UIs.
- **Hybrid:** You can use both together for best results.

## Reactivity & OOHTML

- Use [OOHTML](https://github.com/webqit/oohtml) for reactive UI logic and templates.
- OOHTML enables `<script quantum>` and `<template>` for declarative, reactive UIs.

---

- [See Templates →](./templates.md)
- [See Lifecycle →](./lifecycle.md)
