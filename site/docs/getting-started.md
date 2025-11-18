# Getting Started with Webflo

Welcome! This guide will help you build your first Webflo app from scratch and get it running in minutes, even if you’ve never used the framework before. You’ll learn not just the “how,” but the “why”—and see your results live in the browser.

If you're totally new here, you may want to [meet Webflo](/overview).

---

> [!IMPORTANT]
> 🚀 **Webflo is in active development and evolving daily.** Current status = **beta**.<br>
> You’re welcome to experiment, but it’s not yet suited for production workloads.

::: warning Work in Progress
This documentation is a work in progress. Please expect some rough edges, missing information, and incomplete pages.
:::

## Prerequisites

- **Node.js** 18+ installed
- Basic knowledge of HTML, CSS, and JavaScript
- A terminal/command line interface

## Installation

### Option 1: Local Installation (Recommended)

Install Webflo as a dependency in your project:

```bash
npm install @webqit/webflo
```

### Option 2: Global Installation

Install Webflo globally to use the CLI from anywhere:

```bash
npm install -g @webqit/webflo
```

The scope you choose will determine how you run Webflo commands. The Webflo commands in the rest of this page will show in both `local` and `global` styles.

## Creating a New Project

Webflo provides a CLI command to scaffold new projects:

::: code-group

```bash [local]
npx webflo init my-webflo-app
```

```bash [global]
webflo init my-webflo-app
```

:::

This will create a new directory called `my-webflo-app` with a basic Webflo project structure.

::: tip What happens?
- A starter project is scaffolded from the selected template
- Minimal scripts are added to `package.json`
- Public assets and the `app/` directory are created
:::

### Create Options

The above command could take a project title and project description too:

::: code-group

```bash [local]
npx webflo init my-webflo-app "My Webflo App" "My first ever Webflo app"
```

```bash [global]
webflo init my-webflo-app "My Webflo App" "My first ever Webflo app"
```

:::

And you can specify a template to use:

::: code-group

```bash [local]
npx webflo init my-webflo-app --template=web
```

```bash [global]
webflo init my-webflo-app --template=web
```

:::

The default is: `web`.

### Available Templates

Webflo comes with built-in templates:

- **web** - Standard web application template.<br>Choose for a minimal, conventional web app
- **pwa** - Progressive Web App template with service worker.<br>Choose if you want service worker and offline features from the start

Templates are just starting points — they can evolve and expand freely as your project grows.

### Project Structure

After initialization, your project will have the following structure:

```
my-webflo-app/
├── app/
│   ├── handler.server.js    # Server-side route handlers
│   └── page.html            # Page template
├── public/
│   ├── assets/
│   │   └── app.css          # Styles
│   ├── index.html           # Entry point
│   └── manifest.json        # PWA manifest (if using PWA template)
├── package.json
└── .webflo/                 # Webflo configuration (generated)
```

Note that this is only typical. A few things will vary depending on your chosen template.

### Example `package.json` Structure

The generated `package.json` for your project will include scripts like `dev`, `build`, `start`, among others:

```json
{
  "scripts": {
    "dev": "webflo start --dev",
    "build": "webflo build",
    "start": "webflo start"
  }
}
```

<details><summary>Click here to see a more typical <code>package.json</code> that may be generated for you.</summary>

```js
{
  "title": "My Webflo App", // Human-readable title; set during init, auto-derived from name if omitted; used in templates/UI
  "name": "my-webflo-app",   // npm package name; set during init
  "description": "My first ever Webflo app", // Shown in package managers and can be surfaced in UI
  "version": "1.0.0", // Your app version; semver recommended
  "type": "module",   // Use ES modules; Webflo tooling expects ESM
  "scripts": {
    // Builds HTML templates and client bundles into public/assets
    "build:html": "oohtml bundle --recursive --outdir=public/assets --auto-embed=app",
    "build:js": "webflo build --client --worker --server --recursive --outdir=public/assets --auto-embed",
    // Production build: runs both steps
    "build": "npm run build:html && npm run build:js",
    // Development server with auto-rebuilds and fine-grained HMR
    "dev": "webflo start --dev --build-sensitivity=1",
    // Production server
    "start": "webflo start"
  },
  "dependencies": {
    // Use a semver range for stability in standalone apps
    "@webqit/webflo": "^1"
  },
  "devDependencies": {
    // CLI used to bundle HTML templates; semver range preferred over "latest"
    "@webqit/oohtml-cli": "^2"
  },
  // Optional: constrain Node.js versions used to run your app
  // "engines": { "node": ">=18" }
}
```

> Note that this is only typical. A few things will vary depending on your chosen template.

</details>

You can customize as necessary.

::: info Scripts & customization
- You can customize `build:html` or `build:js` scripts if you need finer control
- Add a `build:css` script if your CSS requires a build step; it'll be called in dev mode as necessary on CSS file changes
- Adjust dev mode's rebuild frequency for assets with `--build-sensitivity` (e.g., `--build-sensitivity=1` — to defer rebuild until page reload; `0` — to turn off)
:::

## Running Your Application

Your Webflo app will run in either *dev* mode or *production* mode.

### Development Mode

Start the development server:

::: code-group

```bash [npm]
npm run dev
```

```bash [global]
webflo start --dev
```

:::

The server starts on `http://localhost:3000` by default.

::: tip What happens? (dev)
- Webflo runs in development mode (with smart, incremental rebuilds on relevant file changes)
- Fine-grained HMR applies updates without full page reloads when possible
- Static assets are served from `public/`; routes resolve from `app/`
- Logs and errors appear in your terminal
:::

### Development Options

- `--open` - Automatically open the browser
- `--port <port>` - Specify a different port

::: code-group

```bash [npm]
npm run dev -- --open --port 8080
```

```bash [global]
webflo start --dev --open --port 8080
```

:::

### Webflo Build

Build your application's client-side assets — `.js`, `.html`, and optionally `.css` (if `build:css` is configured above in `package.json`):

```bash
npm run build
```

This generates optimized static assets and bundles for the client-side of your app.

::: tip What happens? (build)
- Client bundles are generated — `.js`→`public/app.js`, `.html`→`public/app.html`
- Asset references are injected into `public/index.html`
- Output is optimized for production
:::

In *dev* mode, this is not required as Webflo already kicks in Hot Module Replacement (HMR) as you make changes to JS, HTML, and CSS files. But feel free to build as you deem fit.

### Production Mode

Start the production server when ready:

::: code-group

```bash [npm]
npm start
```

```bash [global]
webflo start
```

Your app runs in production mode. Production can be in any filesystem-enabled JavaScript runtime.

::: warning Production differences
- No HMR; assets are cached aggressively by browsers/CDNs
- Ensure environment variables are set (e.g., via `.env` or host config)
- Re-run `webflo build` after code changes intended for production
:::

---

::: tip Good Progress
At this point, your app is open in the browser — time to actually build what we'll see!
:::

## Your First Route Handler

Open `app/handler.server.js` — the default handler file generated for you. You’ll see something like:

```js
export default async function (event, next, fetch) {
    if (next.stepname) return await next();
    return {
        title: 'Webflo Web',
        greeting: 'Hello World!',
        menu: [{ title: 'Home', href: '/' }],
    };
}
```

**What’s it doing?**

- This function handles requests to `/` (the root URL).
- If there’s a deeper route, it delegates to a sub-handler with `next()`.
- Otherwise, it returns data for the root page.

You can build from here — and make it your own:

```js
export default async function (event, next, fetch) {
    if (next.stepname) return await next();
    const name = event.url.searchParams.get('name') || 'World';
    return {
        title: 'Webflo Web',
        greeting: `Hello ${name}!`,
        menu: [{ title: 'Home', href: '/' }],
    };
}
```

Visit `http://localhost:3000/?name=Webflo` to see the response.

If that worked, then we're ready to build! 🚀 We'll build on this foundation incrementally.

## Working with Static Files

Place static files in the `public/` directory. They'll be served automatically by Webflo's static file server. Directory stucture automatically maps to URL paths:

- `public/index.html` → `http://localhost:3000/index.html`
- `public/assets/logo.png` → `http://localhost:3000/assets/logo.png`
- `public/style.css` → `http://localhost:3000/style.css`

Webflo automatically adds appropriate content and caching headers depending on the request. Not found files generate a `404` response.

::: warning Static file handoff
- To leverage Webflo's static file serving, ensure that route handlers are appropriately delegating incoming requests that they're not specifically designed to handle
- This is the handoff line — `if (next.stepname) return next()` — you see in our handler above
- This design, however, ensures route handlers are first in control
:::

## Next Steps

You’ve:

- Scaffolded a project
- Started the dev server
- Written your first handler
- Rendered data in the UI

**Where to go from here?**

- [Core Concepts](/docs/concepts) — Mental model for how everything fits together
- [Routing](/docs/concepts/routing) — How URLs map to files and handlers
- [Rendering](/docs/concepts/rendering) — How data becomes UI
- [Templates](/docs/concepts/templates) — Composing and reusing HTML
- [API Reference](/api/webflo-routing/handler) — Formal handler contract

## Common Commands

<details><summary>Here's a quick reference (Click to show)</summary>

```bash
# Initialize a new project
npx webflo init <project-name>

# Start development server
npx webflo start --dev

# Start production server
npx webflo start

# Build for production
npx webflo build

# Configure Webflo
npx webflo config

# View help
npx webflo --help
```

</details>

## Troubleshooting

- Port already in use?: pass `--port <port>` (e.g., `webflo start --dev --port 8080`)
- Global install issues?: use local CLI via `npx webflo ...` or `npm run` scripts
- Permission problems on Unix?: try `corepack enable` or use a node version manager (nvm)
- Edits not reflecting?: ensure you reloaded or are running dev mode; for production, run `webflo build` again

## Getting Help

- Browse the [Documentation](/docs)
- Visit [GitHub Issues](https://github.com/webqit/webflo/issues)
- Review the [API Reference](/api)

Happy coding with Webflo! 🚀
