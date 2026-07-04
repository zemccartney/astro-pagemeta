# Backlog

> Unsorted, guilt-free. Nothing here is scheduled or owed. Pull items into a
> ROADMAP milestone when — and only when — they become the next thing that matters.

## Features / product

- Dev toolbar app integration for inspecting metadata (or verify compatibility with an existing one)
- First-class `robots` option (typed) — recipe via `custom` ships in M4 first; promote if demand
- i18n: `hreflang` alternates + `og:locale` (design against Astro's i18n APIs)
- Streaming-mode `includeExternalPages` story (currently impossible by design — document only)
- Revisit `defaults`-as-module-path instead of `Function.toString()` serialization (would kill the no-closures limitation; decided against for now — one honest hour during/after M1 if it bugs you)

## Brainstorms queued (from Zack's scratch, 2026-07)

- Image-gen protocol design + a puppeteer-based generator (→ feeds M5; seed code in `image-gen-wip/`)
- Virtual-fs implementation for the test system — could it replace `@inox-tools/astro-tests`, or become a proposed improvement upstream?
- **Rust-based HTML processing** to replace the rehype pipeline — a significant standalone project, not a swap.
    - **Why:** the middleware sits unconditionally in the response critical path; the measured cost is almost entirely rehype's parse/serialize (13.5ms at p50, 110ms at p90 per BENCHMARKS.md). A native processor chases Sätteri-scale gains on the HTML side, and would drop the unified tree (~62 prod packages → near zero).
    - **Why Sätteri itself can't be shoehorned** (investigated 2026-07-03): Markdown engines don't parse raw HTML — CommonMark captures it as opaque "HTML block" tokens passed through verbatim, so any hast Sätteri exposes would contain the document as `raw` string nodes, not a traversable `<head>` element tree (that's why `rehype-raw`/parse5 exists in unified-land: HTML parsing is exactly the part markdown delegates). Worse, CommonMark's HTML-block rules actively mangle full documents — blank lines terminate HTML blocks, and 4-space-indented lines become code blocks. "Valid HTML is valid markdown" only means it survives pass-through, not that it gets parsed.
    - **Search space:** `lol_html` (Cloudflare's streaming HTML rewriter — CSS-selector handlers, and _streaming_ means it could potentially restore HTML streaming in auto mode, today's biggest limitation); `html5ever` (Servo's spec-conformant parser). Verify claims before building on either.
    - **Costs to weigh:** reimplementing rehype-meta's semantics; native-module or WASM distribution (prebuilds per platform vs. wasm portability); non-Node runtimes — note Cloudflare Workers ship `HTMLRewriter` natively, so an adapter-specific fast path might need zero added deps there.
- Benchmarking: how does it all click together across playground + integration? (candidate for an `artifacts/` doc)

## Engineering / tooling

- eslint 10 upgrade; or follow the oxlint/oxfmt/tsgo ports (watch Nakazawa)
- Full Node-version CI matrix beyond the M2 minimal legs
- Expand the test matrix to non-Node runtimes via Astro 6+'s Environment-API dev server — run the suite under real runtimes, starting with Cloudflare (workerd). Zack's old testing.md note anticipated exactly this ("when Astro 6 lands, test under different adapters… esp. cloudflare")
- Bundle impact assessment for consumers (how?)
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

- Guided-tour skill for the codebase; stronger process guardrails (always-run checks, QA pass)
- Test the harness by building a second image generator (satori?)
- Analyze test transcripts to document the dev-server/socket issue properly
