# Astro 6 & 7 — What Shipped While the Project Was Paused

_Written 2026-07-03 (Claude), from [Astro 6.0 announcement](https://astro.build/blog/astro-6/), [Astro 7.0 announcement](https://astro.build/blog/astro-7/), and the [v6](https://docs.astro.build/en/guides/upgrade-to/v6/)/[v7](https://docs.astro.build/en/guides/upgrade-to/v7/) upgrade guides. Two audiences: (1) what pagemeta must react to / test; (2) what's worth using on Zack's own sites later._

## Astro 6.0 (March 2026) — highlights

| Change                                   | What it is                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node 22+ required**                    | Drops Node 18/20 (EOL). Vite 7 across all @astrojs packages. Zod 4 for content schemas (`astro/zod` import location). Shiki 4 for highlighting.                                                                                           |
| **Dev server on Vite's Environment API** | `astro dev` can run your _production runtime_ during development (workerd, Bun, Deno) — ends "works in dev, breaks in prod" for non-Node targets. Rebuilt Cloudflare adapter runs workerd at every stage with real bindings (KV, D1, R2). |
| **Fonts API** (stable)                   | Built-in font management: downloads, caches, optimized fallbacks, preload links; `fonts` config + `<Font />` component.                                                                                                                   |
| **CSP API** (stable)                     | `security: { csp: true }` — automatic hashing of scripts/styles for static _and_ dynamic pages.                                                                                                                                           |
| **Live Content Collections**             | `defineLiveCollection()` — request-time content through the content-layer APIs; coexists with build-time collections.                                                                                                                     |
| Experimental                             | Rust compiler (opt-in via `@astrojs/compiler-rs`); queued rendering (~2x); route caching (`Astro.cache`).                                                                                                                                 |

## Astro 7.0 (June 2026) — highlights

| Change                              | What it is                                                                                                                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rust compiler is default**        | oxc + Lightning CSS. **No more HTML auto-correction**: unclosed tags and malformed attributes are now _errors_ (JSX-style strictness). JSX-style whitespace: newlines between inline elements no longer render as spaces (`{' '}` to force). |
| **Sätteri markdown engine default** | Rust markdown pipeline replaces unified (remark/rehype) _for Astro's markdown processing_. Native GFM, math, directives, wikilinks, heading IDs. remark/rehype users install `@astrojs/markdown-remark` to keep plugins.                     |
| **Vite 8 / Rolldown**               | Rolldown bundler (Rollup-compatible plugin API, esbuild/Rollup options auto-converted). Builds 15–61% faster.                                                                                                                                |
| **Queued rendering default**        | Stable; ~2.4× faster on expression-dense pages.                                                                                                                                                                                              |
| **Route caching stable**            | `Astro.cache` + `routeRules` top-level config; `memoryCache()` built in; experimental CDN providers (Netlify/Vercel/Cloudflare) translate to native platform headers; webhook/tag-based invalidation tied to live collections.               |
| **`src/fetch.ts` advanced routing** | Standard `fetch`-handler entrypoint wrapping the whole pipeline; Hono-compatible; compose Astro features (middleware, actions, i18n) in custom order. Optional.                                                                              |
| **Agent/DX tooling**                | `astro dev --background` (auto-detects AI agents, lockfile, `/_astro/status` health endpoint), JSON logging (`--json`, `logHandlers`).                                                                                                       |
| Removals                            | Astro DB deprecated; its CLI commands (`astro db/login/logout/link/init`) removed.                                                                                                                                                           |

## What this means for pagemeta — tests & checks to add in M1

Ordered by likelihood of actually biting:

1. **Rust compiler strictness vs. test fixtures.** Fixtures with deliberately odd HTML (`no-head.astro`, `partial-full-doc.astro`, `copyright-wrinkle.astro`, the no-head middleware cases) may now be _build errors_ rather than quirky output. Expect fixture repairs before the suite even runs.
2. **Doctype/partial contract re-verification.** The middleware's fragment detection depends on the (undocumented) compiler behavior of stripping doctypes and re-injecting them only for non-partial renders. That behavior was implemented in the Go compiler; the Rust compiler must be re-proven. Route-filtering + partial tests cover this — run them against 7 early.
3. **Dev-server invalidation under the Environment API.** `server.moduleGraph.invalidateModule()` in `src/index.ts` predates the Environment API refactor; per-environment module graphs may make it a no-op or an error. The dev-invalidation manual check (playground) + a dedicated test matter here.
4. **New test: CSP interplay** (v6 stable feature, likely popular). Two questions: (a) does injecting a JSON-LD `<script type="application/ld+json">` _after_ render break `security.csp`? (Data blocks aren't executable, so `script-src` _shouldn't_ apply — verify, don't assume.) (b) does `compressHTML`'s whitespace minification alter any inline `<script>`/`<style>` content whose hash Astro computed at render time → hash mismatch? Needs an actual fixture with CSP enabled.
5. **New test/doc: route caching semantics.** If a response is cached via `Astro.cache`, pagemeta's middleware output is presumably what gets cached (middleware runs inside the pipeline) — confirm, and document the implication: function `defaults` computed per-request become frozen into cached responses.
6. **New check: `src/fetch.ts` composition.** When users compose the pipeline via Hono, does integration-added middleware (`addMiddleware`, order "post") still run? At minimum a docs note; possibly a fixture.
7. **Queued rendering** (default in 7): shouldn't matter — middleware still receives the complete response — but the streaming tests + `Head.astro` path are the guard. No new work unless something fails.
8. **Non-goal clarified:** Sätteri replaces _Astro's markdown_ pipeline, not anything pagemeta does — pagemeta uses rehype directly on rendered HTML, which is orthogonal. (The old RESUMING.md idea "move from unified to the rust engine" conflates the two; a Rust-based HTML transform is a separate, real backlog idea.)

Also worth stealing for this repo's own DX: `astro dev --background` + `/_astro/status` + JSON logs are tailor-made for the AI-harness backlog items (agent-driven playground testing).

## Worth using on your own sites (post-integration shopping list)

- **Fonts API** — replaces hand-rolled `@font-face` + preload dances; automatic fallback metrics. Easy win on the portfolio.
- **CSP via `security: { csp: true }`** — you had "astro CSP video" on the reminder list; it's now a config flag rather than homework. Pairs with the Mozilla Observatory check you wanted to run.
- **Route caching + CDN providers** — for any SSR page: cache with tags, invalidate from a CMS webhook. With live collections, cache hints come free.
- **Live Content Collections** — request-time content with the same `getCollection()` API; interesting anywhere you're tempted to rebuild-on-content-change.
- **Sätteri natives** — math, container directives, wikilinks, smart punctuation without plugin stacks; fewer deps in your blog setup.
- **Cloudflare adapter (v6+)** — if any grepco site targets Workers: real workerd + bindings in dev.
- **`src/fetch.ts`** — probably unnecessary for content sites, but it's the escape hatch if you ever want Hono middleware (auth, rate limiting) around an Astro app.
