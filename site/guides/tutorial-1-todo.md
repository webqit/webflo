# Tutorial: Todo App (Page Coming Soon)

Build a minimal Todo app to learn core Webflo flows.

## 1) Scaffold
```bash
webflo init webflo-todo --template=web
cd webflo-todo
webflo start --dev
```

## 2) Route handler
Edit `app/handler.server.js` to return an initial list and handle add/remove.

## 3) Template
Bind `document.bindings.data` to render and mutate todos.

## 4) Persist
Add simple storage using `event.session` or a backing store.

Next:
- [Routing](/docs/concepts/routing)
- [Rendering](/docs/concepts/rendering)
- [State](/docs/concepts/state)
