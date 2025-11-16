# Templates

Templates let you compose, reuse, and organize HTML in your Webflo app using modern standards.

## The Mental Model

- Use HTML modules and imports to break your UI into reusable pieces.
- Bundle templates for efficient delivery and maintainability.
- Mix and match layouts: Multi Page, Single Page, or Multi SPA.

## Example: HTML Modules & Imports

```html
<!-- public/header.html -->
<header>Header Area</header>

<!-- public/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <template def="app" src="/bundle.html"></template>
  </head>
  <body>
    <import ref="app#header.html"></import>
    <main>Welcome!</main>
  </body>
</html>
```

## Bundling Templates

Use [oohtml-cli](https://github.com/webqit/oohtml-cli):

```bash
npm install -g @webqit/oohtml-cli
oohtml bundle --recursive --auto-embed=app
```

## Layout Patterns

- **Multi Page:** Each route has its own `index.html`.
- **Single Page:** One `index.html`, dynamic content via imports.
- **Multi SPA:** Hybrid; multiple roots, each with SPA subroutes.

---

- [See Rendering →](./rendering.md)
- [See Lifecycle →](./lifecycle.md)
