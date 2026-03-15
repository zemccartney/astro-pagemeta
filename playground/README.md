# Playground

Sample Astro app for manual testing of `@grepco/astro-pagemeta`. Exercises behaviors that are hard to verify in automated tests.

## Setup

From the repo root:

```sh
pnpm install
cd packages/playground
pnpm dev
```

## Pre-Release Manual Test Checklist

Run through these before each release.

### Streaming

Verifies that metadata injection works correctly with Astro's HTML streaming, where `<head>` content must be available before body chunks stream in.

- [ ] Start dev server with `mode: "manual"` (current default in `astro.config.ts`)
- [ ] Load `/streaming` — colored stripes should appear progressively (500ms, 2s, 4s delays)
- [ ] View source: `<head>` should contain the meta tags from `metadata()` (title "Dunganugs", og tags) AND the tags from the `<Pagemeta>` component in the layout
- [ ] Switch `astro.config.ts` to `mode: "auto"` (remove `mode: "manual"`)
- [ ] Load `/streaming` again — page should still render, but streaming behavior may differ (auto mode uses post-render middleware which buffers the full response)
- [ ] Verify meta tags are present in both modes

### Dev Server Module Invalidation

Verifies that adding or removing page files during dev correctly updates the route patterns used for metadata injection, without requiring a server restart.

- [ ] Start dev server
- [ ] Load `/` — verify meta tags are injected
- [ ] Create a new page file, e.g. `src/pages/test-invalidation.astro`:

    ```astro
    ---
    import { metadata } from "@grepco/astro-pagemeta/runtime";
    metadata(Astro, { title: "Invalidation Test" });
    ---

    <html><head></head><body><p>test</p></body></html>
    ```

- [ ] Load `/test-invalidation` — meta tags should be injected (title "Invalidation Test") without restarting the server
- [ ] Delete the file
- [ ] Verify `/test-invalidation` returns 404
