# Bug report (local): Astro 7.3 dev re-evaluates any module that imports `astro/middleware` on every request

Status: **not filed upstream** (Zack, 2026-09-20). Kept here so Zack can review, build a simpler reproduction, and decide later. Written by the agent from the 2026-09-19 investigation; every claim is marked _verified_ (ran it, saw it) or _read_ (from Astro's dist source at 7.3.2) or _inferred_.

## Summary

Since Astro 7.3.0, the `astro/middleware` entry (`dist/core/middleware/index.js`) imports `core/manifest/ambient.js`, which imports the virtual module `#astro-internal/ambient-manifest` (`virtual:astro:manifest`). In the dev server that virtual module is invalidated on effectively every page request, and Vite propagates invalidation to importers. Result: every user or integration module that does `import { defineMiddleware } from "astro/middleware"` is re-executed on the next request, so any module-level state in it (a `Symbol()`, a cache, a `WeakMap`, a counter) is silently replaced. The middleware instance Astro registered at startup keeps the _old_ module's state, while pages importing the same module get the _new_ one.

Before 7.3.0 the `astro/middleware` entry had no edge into the manifest graph and such modules were evaluated once per server lifetime.

## Versions

|                 |                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Astro last good | 7.2.10 (_verified_ by bisect)                                                                                         |
| Astro first bad | 7.3.0 (_verified_ by bisect); still present in 7.3.2                                                                  |
| Node            | 24 (also reproduced on 22.12 in CI)                                                                                   |
| Vite            | 8.3 (Astro's bundled)                                                                                                 |
| Affects         | `astro dev` only. `astro build` / SSR adapters evaluate once and are fine (_verified_: only dev-server tests failed). |

## The chain, from Astro 7.3.2 dist source (_read_)

1. `core/middleware/index.js:12` — `import { tryGetAmbientManifest } from "../manifest/ambient.js";` (new in 7.3.0, added with the logger/manifest work; BACKLOG cites #17818).
2. `core/manifest/ambient.js:3` — `import { manifest as viteManifest } from "#astro-internal/ambient-manifest";`
3. `manifest/serialized.js:31-33` — `#astro-internal/ambient-manifest` is the specifier for `virtual:astro:manifest`; its generated code (line ~131) references `virtual:astro:server-island-manifest` via `serverIslandMappings: () => import('...')`, so the server-island manifest is an imported module of the manifest in Vite's graph.
4. `core/server-islands/vite-plugin-server-islands.js:80-117` — the plugin's `transform` hook runs for every `.astro`/`.mdx` file and for the server-island manifest itself; when the project has any server island it calls `env.moduleGraph.invalidateModule(<server-island manifest>)` on each such transform.
5. Vite's `invalidateModule` walks `importers` recursively. So: server-island manifest → `virtual:astro:manifest` → `core/manifest/ambient.js` → `core/middleware/index.js` (the `astro/middleware` entry) → **every module that imports `astro/middleware`**.

_Inferred_: the invalidation also fires in projects without server islands through other manifest inputs (routes, pages module), because the affected test fixtures include ones without islands. Not isolated; a simpler repro should test both.

## Observed effect (_verified_, 2026-09-19)

Probe: a throwaway integration registered in `astro:server:setup` that wrapped `server.environments.ssr.moduleGraph.invalidateModule` with `console.log(new Error().stack)` and then fetched four pages. Our runtime bundle (`dist/runtime.mjs`, which imports `astro/middleware`) was invalidated **14 times across 4 requests**, each stack ending in the server-islands transform at line 114. An instrumented build that logged `Symbol()` creation showed a fresh symbol per re-evaluation.

Failure mode in this package: `metadata()` (called by pages, so resolved through the freshly re-evaluated module) stored under symbol B; the middleware closure, created once at startup, read under symbol A; five dev-server tests silently fell back to defaults. The SSR dependency optimizer was off, so this is not the optimizer.

## Minimal reproduction (as it stands; Zack to simplify)

The package's regression test reproduces the module-instance half without Astro:

```ts
// packages/ephemeris/tests/unit/core.test.ts, "locals key across module instances"
vi.resetModules();
const a = await import("../../src/core.ts");
vi.resetModules();
const b = await import("../../src/core.ts");
a.metadata(ctx, { title: "From instance A" });
expect(b.createMetadataProcessor({...}).resolveMetadata(ctx)).toEqual({ title: "From instance A" });
```

To see the Astro half: change `LOCALS_KEY` in `src/core.ts` from `Symbol.for("@grepco/ephemeris")` back to `Symbol("ephemeris")`, then run the route-filtering dev-server test; "rewrite has target's meta tags" fails.

A standalone repro for upstream would be a bare `npm create astro` project with:

```ts
// src/counter.ts
import { defineMiddleware } from "astro/middleware";
export const evaluatedAt = Date.now();
console.log("counter.ts evaluated", evaluatedAt);
export const onRequest = defineMiddleware((_ctx, next) => next());
```

imported from both `src/middleware.ts` and a page; on 7.2.10 the log line prints once per server, on 7.3.x once per request (expected, _not yet run_).

## Why it matters upstream

`defineMiddleware` is the documented way to type middleware, and the docs suggest importing it from `astro/middleware` in library code. Any library that keeps module-level state next to that import (request-scoped caches keyed by symbol, rate limiters, once-flags) now has that state reset per dev request, with no warning, and behaves differently in dev than in build. Astro's own `serialized.js` carries a comment acknowledging that "the dev module graph re-evaluates after invalidation," so the re-evaluation is known; the reach into `astro/middleware` looks unintended.

## Our mitigation (shipped, afe3980)

`Symbol.for("@grepco/ephemeris")` instead of a private `Symbol()`, so every module instance resolves the same registry key. Decision 2026-09-20: keep it, and do **not** also remove the runtime `astro/middleware` import, since that would work only because of what we inferred about Astro's internals.

## Open questions for Zack

- Does the standalone repro above show once-per-request on 7.3.x with no server islands in the project?
- Is the re-evaluation bounded (once per request) or does it compound with the number of `.astro` files transformed?
- Is `defineMiddleware` from `astro/middleware` really recommended for library code, or should libraries type against `MiddlewareHandler` from `astro`? If the latter, the report becomes a docs request.
