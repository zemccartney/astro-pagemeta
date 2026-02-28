# Streaming mode

## Context

The default middleware-based architecture buffers the entire HTML response (`response.text()`) to rewrite the `<head>` with rehype + rehype-meta. This defeats Astro's HTML streaming — the client can't receive any bytes until the full page is rendered and processed.

For **static sites this doesn't matter** (pages are pre-rendered). For SSR, it adds latency proportional to page size. With server islands, many sites can now be factored as purely static, reserving SSR for dynamic-data sites where metadata is often less critical (e.g., apps behind auth). But for SSR sites that do care about meta tag performance (e-commerce, dynamic content), we need an escape hatch.

**Goal**: An opt-in component-based "streaming" mode that preserves HTML streaming, while keeping the current middleware approach as the default.

## Architecture: shared pipeline

Rather than maintaining two separate implementations, the `<Pagemeta>` component reuses the **same rehype processing pipeline** (`_getHtmlProcessor` from `runtime.ts`) as the auto-mode middleware. A custom `rehypeHeadContentsOnly` plugin extracts just the `<head>` children after processing, producing inline content suitable for rendering inside a static `<head>` element.

### How the component works

1. `resolvePagemeta(Astro)` merges integration defaults + `setPagemeta()` data
2. `Astro.slots.render("default")` captures the slot children (template meta tags)
3. The slot HTML is processed through the rehype pipeline in document mode — rehype wraps it in `<html><head>...</head></html>`, and rehype-meta operates on the `<head>`
4. `rehypeHeadContentsOnly` strips the document wrapper, returning only the head children
5. The processed content is rendered via `<Fragment set:html={...} />`

When there's no metadata to apply, the slot content passes through unchanged.

### Why this works

Both modes use the same pipeline, so tag content is always identical. rehype-meta's `ensure()` logic works within the component's slot scope — if a `<title>` exists in the slot children and `setPagemeta()` also sets a title, the existing tag is updated rather than duplicated.

## Usage

```astro
---
import { setPagemeta } from "@grepco/astro-pagemeta/runtime";
import Pagemeta from "@grepco/astro-pagemeta/Pagemeta";

setPagemeta(Astro, {
    description: "Page description",
    title: "Page Title"
});
---

<!doctype html>
<html lang="en">
    <head>
        <Pagemeta>
            <meta charset="utf-8" />
            <meta
                content="width=device-width"
                name="viewport"
            />
        </Pagemeta>
    </head>
    <body>
        <p>Content here</p>
    </body>
</html>
```

Integration config:

```ts
pagemeta({ mode: "streaming" });
pagemeta({ mode: "streaming", defaults: { author: "Jane Doe" } });
```

## Mode comparison

|                                           | `auto` (default) | `auto` + `manual: true` | `streaming`         |
| ----------------------------------------- | ---------------- | ----------------------- | ------------------- |
| Middleware registered                     | yes              | no                      | no                  |
| `<Pagemeta />` component expected         | no               | n/a (user's choice)     | yes                 |
| HTML streaming preserved                  | no               | n/a                     | yes                 |
| Dedup with tags inside `<Pagemeta>` slot  | n/a              | n/a                     | yes                 |
| Dedup with tags outside `<Pagemeta>` slot | yes (full page)  | n/a                     | no                  |
| rehype runtime dependency                 | yes              | no                      | yes (same pipeline) |

## Tag ordering in `<head>`

Auto mode and streaming mode produce different element orderings in `<head>` due to when meta tags are inserted relative to Astro's asset injection (styles, scripts).

**Auto mode (middleware)**: Astro renders the full page — including injecting component styles and scripts into `<head>` — then the middleware buffers the complete HTML and runs rehype-meta, which appends meta tags at the end of `<head>`. Result: template tags appear first, then Astro-injected assets, then meta tags last.

```
<meta charset="utf-8">          ← template
<style>...</style>               ← Astro-injected (component styles)
<title>Page Title</title>        ← middleware-appended
<meta name="description" ...>    ← middleware-appended
```

**Streaming mode (component)**: The `<Pagemeta>` component renders inline at its position in the template. Its meta tag output appears at that position. Astro then injects styles and scripts separately, typically after the component's output. Result: meta tags appear first (at the component's position), then Astro-injected assets.

```
<meta charset="utf-8">          ← component slot + output
<title>Page Title</title>        ← component output
<meta name="description" ...>    ← component output
<style>...</style>               ← Astro-injected (component styles)
```

This ordering difference is cosmetic — browsers process `<head>` elements regardless of order. But it's visible in view-source and test assertions.

## Caveats

- **`<head>` must be a static element.** Astro needs a literal `<head>` tag in the template for asset injection (styles, scripts). Rendering `<head>` via a component breaks this.
- **Declare the component in every layout that has its own `<head>`.** There's no automatic injection — each discrete `<head>` needs its own `<Pagemeta>`.
- **Put template meta tags inside the slot.** Tags placed directly in `<head>` alongside `<Pagemeta>` won't be deduplicated. Passing them as children gives rehype-meta visibility into them.
- **`includeExternal` is meaningless in streaming mode.** That option controls which routes the middleware processes; streaming mode has no middleware.
    - This option is useful for applying defaults to integration-injected pages where you don't have template access. streaming mode requires template modification, so even with that option enabled in streaming mode, the only effect would be including external pages in your bundle via outputting their route pattern regexes, but to no end, since the isPage function that calls that makes sense only in middleware

## Options schema

`manual` is a sub-option of `auto` mode, not a peer mode. The TypeScript types enforce this relationship — `manual` is only valid when `mode` is `'auto'` (explicitly or by default), and produces a TS error when `mode` is `'streaming'`.

```ts
// Valid:
pagemeta(); // auto, middleware active
pagemeta({ mode: "auto" }); // explicit auto
pagemeta({ mode: "auto", manual: true }); // auto, no middleware
pagemeta({ manual: true }); // auto (default), no middleware
pagemeta({ mode: "streaming" }); // streaming, component expected

// Invalid (TS error + Zod runtime error):
pagemeta({ mode: "streaming", manual: true }); // manual is not valid for streaming
```
