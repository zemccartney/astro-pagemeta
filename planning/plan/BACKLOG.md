# Backlog

> Unsorted, guilt-free. Nothing here is scheduled or owed. Pull items into a
> ROADMAP milestone when — and only when — they become the next thing that matters.

## Features / product

- `http-equiv` pragma support via the existing magic-key DSL (`custom: { "meta:httpEquiv:refresh": ... }` — precedent: `meta:charSet`), allowlisted to real pragmas, hard-error outside the list, reject `content-type` (conflicts with `meta:charSet`). Decided 2026-07-05: **not until a live use case** (only plausible one: programmatic `refresh` for generated redirect stubs); templates already pass pragmas through untouched

- Dev toolbar app integration for inspecting metadata (or verify compatibility with an existing one)
- First-class `robots` option (typed) — recipe via `custom` ships in M4 first; promote if demand
- i18n: `hreflang` alternates + `og:locale` (design against Astro's i18n APIs)
- Streaming-mode `includeExternalPages` story (currently impossible by design — document only)
- Revisit `defaults`-as-module-path instead of `Function.toString()` serialization (would kill the no-closures limitation; decided against for now — one honest hour during/after M1 if it bugs you)

## Brainstorms queued (from Zack's scratch, 2026-07)

- Image-gen protocol design + a puppeteer-based generator (→ feeds M5; seed code in `image-gen-wip/`)
- Test-harness evolution — was one "virtual-fs" bullet; split 2026-07-05 (Zack's catch) because these are three ideas with different motivations, and only one is a perf lever. Step one for all of them landed in M1 (harness vendored into our tree), so each is a refactor of our own code:
    - **Virtual-fs fixtures** (Zack's original idea): in-memory fixture files instead of `isolatedFixture`'s disk copies to `.test-tmp/`. Motivation: isolation ergonomics and fixture-count scaling — **not** perf (copies measured at 68K, microseconds) and **not** servers (doesn't touch them)
    - **In-process request dispatch**: call the dev server's handler directly (supertest-style) instead of real HTTP via undici/TCP. Motivation: eliminates the historical `SocketError` class and ~100ms first-fetch overhead. Doesn't address suite-time contention
    - **Fewer pipeline instantiations**: shared fixtures/dev servers across test files. The **only** lever against the Astro-6 contention (cost is per-`dev()`/`build()` astro+vite pipeline instantiation — see testing-isolation.md 2026-07-05 addendum). In genuine tension with the one-fixture-per-mode isolation principle — needs its own design think before building
- **Rust-based HTML processing** to replace the rehype pipeline — a significant standalone project, not a swap.
    - **Why:** the middleware sits unconditionally in the response critical path; the measured cost is almost entirely rehype's parse/serialize (13.5ms at p50, 110ms at p90 per BENCHMARKS.md). A native processor chases Sätteri-scale gains on the HTML side, and would drop the unified tree (~62 prod packages → near zero).
    - **Why Sätteri itself can't be shoehorned** (investigated 2026-07-03): Markdown engines don't parse raw HTML — CommonMark captures it as opaque "HTML block" tokens passed through verbatim, so any hast Sätteri exposes would contain the document as `raw` string nodes, not a traversable `<head>` element tree (that's why `rehype-raw`/parse5 exists in unified-land: HTML parsing is exactly the part markdown delegates). Worse, CommonMark's HTML-block rules actively mangle full documents — blank lines terminate HTML blocks, and 4-space-indented lines become code blocks. "Valid HTML is valid markdown" only means it survives pass-through, not that it gets parsed.
    - **Search space:** `lol_html` (Cloudflare's streaming HTML rewriter — CSS-selector handlers, and _streaming_ means it could potentially restore HTML streaming in auto mode, today's biggest limitation); `html5ever` (Servo's spec-conformant parser). Verify claims before building on either.
    - **lol-html js-api findings (checked 2026-07-03):** the repo ships an official WASM binding (`js-api/`, wasm-pack, Node target) exposing the `HTMLRewriter` interface — `on(selector, handlers)`, get/setAttribute, `onEndTag`, streaming `write()`/`end()`. Handlers are sync, which fits (metadata is fully resolved before processing). Fit is real: update-in-place via element handlers on `head`/`title`/`meta`/`link` + track seen keys + append missing at `</head>` is the native idiom, and since `<head>` arrives at the top of the stream, injection completes in the first chunks — auto mode could pipe `response.body` through a TransformStream and keep streaming. Because the interface mirrors Workers' native `HTMLRewriter`, one handler implementation could run on the platform-native rewriter on Cloudflare (zero deps) and WASM elsewhere.
    - **Caveats found:** ⚠️ the `lol-html` name on npm is an **unofficial fork** (taina0407), not Cloudflare — don't install it; the real options are building/publishing the wasm binding ourselves from cloudflare/lol-html, or the community `htmlrewriter` wrapper (small maintainer — trust call). No DOM tree means no parser error-recovery: documents lacking `<head>` won't get one auto-created (rehype does this today; tested behavior — needs explicit handling or a documented behavior change). `compressHTML` — _revised 2026-07-03 (Zack's catch)_: the whole-tree `rehype-minify-whitespace` pass exists only because rehype-meta's readability newlines aren't configurable, so we strip them after the fact (~15ms at p50 for what is mostly a no-op walk — Astro already compressed the incoming HTML). With `lol_html` we author the inserted bytes directly, so this collapses to a formatting flag on insertions (newline in dev-pretty mode, none when compressing) — the pass and its cost disappear, and untouched bytes gain **verbatim** passthrough (today's re-serialization can subtly alter user HTML). Spike-verify the one assumption: incoming HTML is already compressed in both dev and build when `compressHTML` is on. WASM-boundary chatter per element is the perf cost center — extend the existing bench harness with a lol-html baseline before committing.
    - **Costs to weigh:** reimplementing rehype-meta's semantics; owning WASM build/publish vs. trusting a wrapper; non-Node runtimes (native `HTMLRewriter` fast path on Workers).
- Benchmarking: how does it all click together across playground + integration? (candidate for an `artifacts/` doc)

## Engineering / tooling

- eslint 10 upgrade; or follow the oxlint/oxfmt/tsgo ports (watch Nakazawa)
- Full Node-version CI matrix beyond the M2 minimal legs
- Expand the test matrix to non-Node runtimes via Astro 6+'s Environment-API dev server — run the suite under real runtimes, starting with Cloudflare (workerd). Zack's old testing.md note anticipated exactly this ("when Astro 6 lands, test under different adapters… esp. cloudflare")
- Bundle impact assessment for consumers (how?)
- README restructuring as image processors land: root README becomes a workspace map (integration = main package, described there; pointers to where other packages' docs live)
- `isolatedDeclarations`-enabled tsconfig simplification (cosmetic; post-M1 only)
- OpenSSF Scorecard badge
- Local registry testing (verdaccio) for pre-publish install verification — only if scratch-project installs prove insufficient
- Fresh clone + install on a clean machine to catch latent local-only fixes

## Bug reports / upstream questions (Astro, Discord)

- Partials exposed in routing metadata per `astro:routes:resolved`?
- Can end users control/override the `@types/node` version Astro injects? (typecheck passes locally but crashes on mismatched runtime node?)
- How should library authors reason about server-side output targets / browser vs server compatibility guarantees?
- Ask about their view on middleware-based head manipulation + the doctype/partial contract (is stripped-doctype-for-partials stable behavior?)

## Learning (reference material — attach to milestones, never prerequisites)

- Google special tags: https://developers.google.com/search/docs/crawling-indexing/special-tags (→ read when writing M4 recipes)
- MDN webpage metadata: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Webpage_metadata
- Astro HTML streaming implications: https://angelika.me/2025/03/16/implications-of-astro-html-streaming/ (largely absorbed already — streaming.md exists)
- Search Console on own sites; intuition for OG / JSON-LD in practice (→ M3 dogfooding is the lab)
- Package publishing understanding → blog-post-to-self (draft during M2 while it's fresh)

## Writing / publicity

- Blog: virtual modules deep-dive
- Blog: the testing strategy and why it's shaped this way (ask Astro team for reaction?)
- Blog/note-to-self: package publishing end-to-end
- Prove/reproduce the race condition in astro-metadata's module-level store (competitive claim — verify before ever citing publicly)

## AI harness (meta-work on how you build here)

- **Vendoring-update skill** (Zack, 2026-07-05): encode the astro-fixture upstream-check as scripts wherever possible — fetching/diffing the two upstreams is mechanical (commands already in `packages/astro-fixture/README.md`); judging what to absorb stays heuristic. Deliverable: a documented, agent-runnable capability, not memory
- Guided-tour skill for the codebase; stronger process guardrails (always-run checks, QA pass)
- Test the harness by building a second image generator (satori?)
- Analyze test transcripts to document the dev-server/socket issue properly

## Follow-ups from the 2026-09-19 re-entry tranche

- **Upstream report candidate — Astro 7.3 `astro/middleware` sits in the dev manifest invalidation cone.** `core/middleware/index.js` gained `import { tryGetAmbientManifest } from "../manifest/ambient.js"` in 7.3.0 (#17818 logger work); `ambient.js` imports `#astro-internal/ambient-manifest`. In dev, every request's `virtual:astro:server-island-manifest` transform invalidates `virtual:astro:manifest`, and Vite propagates that through importers to `astro/middleware` and to anything importing it — our runtime bundle was re-evaluated 14 times across four requests (traced 2026-09-19). Any integration keeping module-level state next to a `defineMiddleware` import breaks silently. We hardened ourselves with `Symbol.for`; Zack decides whether to file (a minimal repro is the `locals key across module instances` unit test plus the trace in the ROADMAP entry).
- **Drop the runtime import of `astro/middleware`.** `defineMiddleware` is an identity function used for typing; `MiddlewareHandler` from `astro` (type-only) gives the same typing with no runtime edge into Astro's graph. Removes us from the invalidation cone entirely (today the runtime and its rehype processor are rebuilt per dev request under 7.3). Own commit, verify with the module-graph probe pattern from 2026-09-19.
- **Deferred majors from the deps sweep:** `typescript` 6 → 7 (the native port; expect a full leg like TS 6 was), `undici` 7 → 8 (harness only), `tsdown` 0.22 → 0.23 (read the changelog; attw/publint gates will catch export drift). Run `pnpm deps` to see them.
- **Doc drift confirmed today (fold into M4):** CLAUDE.md said exports map to `src/` — they map to `dist/`, and `pretest` builds. Corrected the three lines that misled the session; the rest of the M4 list stands.

## Follow-ups from the 2026-09-20 rename

- ~~**Repo rename (Zack):** rename `zemccartney/astro-pagemeta` → `zemccartney/ephemeris` on GitHub, then update `homepage`/`bugs`/`repository` in `packages/ephemeris/package.json` and `git remote set-url origin`.~~ _(done 2026-09-20: repo and local folder renamed by Zack; manifest URLs and remote updated in the follow-up commit)_
- **README tagline:** the title is now just "ephemeris"; the first line under it should say what the name means in one sentence, since the word no longer describes the job the way "pagemeta" did. Fold into the M4 README work.

## Zack's wishlist from the 2026-09-19 re-entry (ordering proposed in chat, not yet decided)

- **mise + hk** for scripts, env vars and system deps (replacing the pnpm-scripts + lefthook + `.npmrc` engine-strict arrangement). Proposed slot: M4 maintenance routine, after publish; nothing blocks on it now and it would widen any earlier tranche. Note the interaction with `engines`/`check:engines`: mise would own the Node version locally, CI keeps `setup-node`.
- **Supply-chain understanding before automation** (already noted on the M2 Socket line): a written explainer on provenance, OIDC trusted publishing, Socket, lockfile trust and `minimumReleaseAge`, then the config.
- **Dependency majors sweep** (TS 7, undici 8, tsdown 0.23): see "Deferred majors" above; own leg after M2.
- ~~**Rename**~~ done 2026-09-20.
