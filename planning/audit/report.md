# astro-pagemeta — Project Health Audit

_Audit date: 2026-07-03. Conducted against commit `fc3467b` (dev branch)._

## TLDR

**The project is in much better shape than your dread suggests.** Every check passes today: 269 tests green in 15 seconds, typecheck clean, lint clean, build works, publint clean. The code is small (6 source files), well-commented, and shows unusual rigor (benchmarks tied to Web Almanac data, supply-chain hardening in pnpm config, JSDoc on public APIs).

**The real work is not fixing broken things — it's ecosystem catch-up.** While you were out, Astro shipped **two major versions** (6.0 in March 2026, 7.0 in June 2026), and `astro-integration-kit` was formally deprecated. Your package peer-depends on `astro: ^5.0.0` and tests against 5.18. That's the single biggest item between you and a publish worth doing, and it should come **before** any polishing, because it's the only work that could force design changes.

Your four worries, in one line each:

1. **Test suite over-engineered?** No. It's an asset. The docs _about_ the tests are stale; fix those, not the tests.
2. **tsconfig ceremony?** It's done, it passes, it's a standard shape for a published library in a workspace. Stop relitigating it.
3. **Competitive doubt?** Your own assessment doc is honest and holds up. The niche is real but small. Ship it anyway — that was always the plan.
4. **Domain gaps?** Fewer than you fear. The one visible gap (robots/noindex) is already coverable via `custom`. What's missing is _recipes in docs_, not features.

---

## 1. Health check results (run 2026-07-03)

| Check                             | Result            | Notes                                                                                                                                                                                                                     |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test` (269 tests, 24 files) | ✅ pass, 15.4s    | Zero flakes on this run                                                                                                                                                                                                   |
| `tsc -b` via `typecheck`          | ✅ pass           | Includes playground `astro check`                                                                                                                                                                                         |
| `tsdown` build                    | ✅ pass           | publint clean                                                                                                                                                                                                             |
| `attw`                            | ⚠️ warns          | "No resolution (node16-esm / bundler) at `/Head`" — expected for a bare `.astro` export, but worth an explicit attw ignore + a manual verify that `import Head from "@grepco/astro-pagemeta/Head"` resolves in a consumer |
| `pnpm lint`                       | ✅ pass           |                                                                                                                                                                                                                           |
| `pnpm fmt`                        | ❌ fail (trivial) | Only `.claude/settings.local.json` — add to `.prettierignore`                                                                                                                                                             |
| `pnpm knip`                       | ❌ fail (config)  | Flags the 5 `bench/` files as unused — add bench entry points to `knip.json`                                                                                                                                              |
| Working tree                      | ✅ clean          | Yesterday's commit captured everything; only `planning/` and `fable-audit/` untracked                                                                                                                                     |

Dependency freshness: dev deps are mildly stale (eslint 10, knip 6, vitest 4.1 available — all routine). The ones that matter:

- `astro` 5.18.0 → **7.0.6 latest** (peer dep says `^5.0.0`)
- `astro-integration-kit` 0.19.1 → 0.20.0, **deprecated** ([migration guide](https://astro-integration-kit.netlify.app/migration-guide/))
- `@inox-tools/astro-tests` 0.8.1 → **1.0.0** (your test harness; the 1.0 almost certainly tracks Astro 6/7)
- `schema-dts` 1.1.5 → 2.0.0

## 2. The strategic finding: Astro moved two majors

What shipped while you were away (your RESUMING.md notes were right, including the Rust engine):

- **Astro 6.0 (March 2026)**: requires **Node 22+**, Vite 7, and — most relevant to you — a **dev server refactor onto Vite's Environment API** ("run your exact production runtime during development"). ([astro.build/blog/astro-6](https://astro.build/blog/astro-6/))
- **Astro 7.0 (June 2026)**: Vite 8, the **Rust compiler is now the default** (stricter about invalid HTML, no longer auto-corrects markup), Sätteri (native markdown) replaces remark/rehype as the default markdown pipeline. ([upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/))

### Specific risk points in _your_ code (ranked)

1. **`astro-integration-kit` is deprecated.** You use four things from it: `defineIntegration`, `optionsSchema` (via `astro/zod`), `createResolver`, `addVitePlugin`. All four are thin conveniences over plain Astro APIs — this is a small, mechanical migration (an integration is just a function returning `{ name, hooks }`; `createResolver` is `new URL("./middleware.js", import.meta.url)`; `addVitePlugin` is `updateConfig({ vite: { plugins: [...] } })`). Zod validation of options can be inlined or hand-rolled. Half a day, maybe less.
2. **Virtual module invalidation uses `server.moduleGraph`** (`src/index.ts:178`). Vite's Environment API (the basis of Astro 6's dev server refactor) moves module graphs to per-environment; `ViteDevServer.moduleGraph` is on a deprecation path. Your dev-invalidation logic is the code most likely to actually break under Astro 6/7. Your existing "tied to restart b/c otherwise test flakiness... I guess? Unclear" comment already marks this as the least-understood corner of the codebase — budget real time here.
3. **Doctype-based fragment detection** (`src/middleware.ts:56-71`). Your own comment flags that this relies on undocumented compiler behavior (doctype stripped for partials/server islands). Astro 7 swapped the compiler from Go to Rust. Your route-filtering tests will tell you immediately whether the behavior held — this is exactly what that "clunky, redundant" test matrix is for.
4. **Hooks you depend on** (`astro:routes:resolved`, `addMiddleware` with `order: "post"`, `config.compressHTML`): no evidence of removal in the upgrade guides, but verify by running the suite against 6 and 7.
5. **Test harness**: expect to bump `@inox-tools/astro-tests` to 1.0 as part of the same effort.

### Recommendation on version support

Do **not** publish an Astro-5-only package in July 2026 — anyone evaluating integrations today is on 6 or 7, and "peer: ^5.0.0" reads as abandoned-on-arrival. Equally, don't build a 3-major test matrix before first publish. Pragmatic path:

- Upgrade the workspace to Astro 7. Fix what breaks.
- Then check whether the same code passes against 6 (likely) and 5 (maybe). Set the peer range to what the test suite actually proves — probably `^6.0.0 || ^7.0.0`, keeping 5 only if it's free.
- Node engines simplify too: Astro 6+ requires Node 22+, so `publishConfig.engines` can become `>=22`, and the `tsdown` `target: "node18"` and `lib: es2022` hand-wringing (see §4) mostly evaporates.

## 3. Architecture, security, correctness review

### Architecture: sound, and the competitive doc's critique is already half-answered

The core design (Symbol-keyed per-request locals → post-render middleware → rehype pipeline, with route filtering from `astro:routes:resolved`) is coherent and the code is clean. Notably, the biggest criticism in your `competition-assessment.md` — "rehype buffering breaks streaming, the component approach is faster" — **you already shipped the answer**: `mode: "manual"` + `Head.astro` reuses the same pipeline scoped to head contents (0.05ms in your benchmarks vs 13.5ms full-document at p50). The doc predates the component and undersells your current position. Update it before it demoralizes you further.

Remaining architectural observations (none blocking):

- **Function-defaults serialization** (`Function.toString()` into the virtual module, no closures) is the one genuinely exotic mechanism left. It works, it's tested, it's documented — but when you migrate off integration-kit, it's worth one honest hour asking whether `defaults` could instead be loaded from a user-provided module path (like Astro does for middleware/adapters), which would kill the closure limitation and the weirdest code in the repo. Decide once, write the decision down, move on.
- **Middleware response handling** (`src/middleware.ts:72-87`): both re-wrap paths preserve `headers` and `status` but drop `statusText`; and if an upstream response ever carries a `Content-Length` header, re-using the old headers with mutated HTML would produce a mismatched length. I did not verify whether any Astro adapter actually sets Content-Length before middleware runs — cheap to defend against (delete the header when rewriting), worth a test.
- **`isPageRoute` matches on pathname only.** Config-injected redirects and endpoints are filtered by pattern origin, which is right; just note that overlapping patterns (e.g. a catch-all `[...slug]`) will match API-ish paths if a project defines both — your filtering already handles the cases Astro distinguishes, so this is a docs footnote, not a bug.

### Security: no findings that matter

- The only "code injection" surface is serializing the user's own config into their own build — not a vulnerability.
- rehype parse/re-serialize of author HTML introduces no injection vector; JSON-LD is `JSON.stringify`ed. One classic footgun to note in docs: a `</script>` sequence inside user-supplied JSON-LD string values can break out of the script tag. `JSON.stringify` does not escape `<`/`>`. If you want to be thorough, escape `<` as `<` in the JSON-LD serializer — it's a two-line change and standard practice.
- Supply-chain posture is _above_ average for a hobby project: `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `blockExoticSubdeps`, pinned `onlyBuiltDependencies`. Your planned Renovate/审 audit items are nice-to-haves, not gaps.

### Documentation drift (the actual "lack of clarity in maintainability" problem)

This is where the project genuinely bit-rotted, and I suspect it's a big contributor to your overwhelm — the docs describe a project that no longer exists, so re-reading them produces confusion instead of orientation:

- **`CLAUDE.md`**: says "four source files" (there are six incl. `Head.astro` + `core.ts`), describes a `tests/basic/...` layout that's now `tests/integration/...`, doesn't mention `mode: "manual"`, `Head`, benchmarks, or tsdown.
- **`MAINTENANCE.md` (root)**: describes a `runtime-stub.js` and `@inox-tools/aik-mod`-based virtual module system that the code no longer uses (you moved to a hand-rolled Vite plugin), and a test layout (`static/build.test.ts` per mode) that no longer exists.
- **`playground/README.md`**: says `packages/playground` (it's `playground/` at root) and references a `<Pagemeta>` component (the export is `Head`).
- **Two overlapping planning systems** (`.plan/` from March, `planning/` from this week) plus a deleted `TODO.md`.

None of this is hard to fix; all of it should be fixed in one sitting, because stale docs are compound-interest debt for a solo maintainer returning from breaks.

## 4. Your four named concerns

### a) Is the test suite over-engineered?

**No — and I'd push back on the framing.** Evidence: 269 tests across 24 files run in **15 seconds** and passed cold after 3 months away. That is the single most valuable asset this project has for your stated goal ("system to check for regressions over time"). It's about to earn its keep spectacularly: the Astro 6/7 upgrade risk list in §2 is almost entirely covered by tests you already wrote (route filtering, doctype/partials, dev invalidation, middleware ordering, static/SSR × dev/build).

The justification in `maintenance/testing.md` — "favor clunkiness and redundancy for documentary proof across Astro's mechanical flexibility; adversarial, always-prove-it view" — is exactly the right posture for a library that hooks undocumented behavior (doctype stripping) and four different lifecycle stages. The `isolatedFixture` utility is 50 lines; that's not over-engineering, that's a small tool.

What _is_ real: the constraints (one build config per file, fixture configs must not include the integration, socket-error flakiness) are all consequences of `@inox-tools/inline-mod`'s global registry and the dev-server harness — i.e., **inherited quirks, not your design flaws**. Two genuine simplification opportunities, both optional:

1. `@inox-tools/astro-tests` 1.0 may have fixed the double-registration and socket issues — check its changelog during the upgrade before spending any effort working around them further.
2. The unit layer (`tests/unit/core.test.ts`) already covers merge/cascade logic fast; if you ever want to shrink the integration matrix, cut _duplicated assertions_ between basic/custom-meta/component suites, not the static/SSR × dev/build structure.

### b) tsconfig futzing

**Verdict: it's fine, it's finished, leave it.** The shape you landed on — a composite `src/tsconfig.json` (library code: `isolatedDeclarations`, `module: preserve`, `lib: es2022`) referenced by a package-root tsconfig (tests/bench/scripts: node types, astro client types) extending a strict shared base — is the _standard_ shape for a published package inside a workspace. Project references marking the src boundary is a feature, as you said yourself. It typechecks clean today. The ceremony was a one-time cost that's already paid.

The open questions in `maintenance/tsconfig.md` mostly dissolve with the Astro upgrade: once your floor is Astro 6 → Node 22, you can raise `lib` and the tsdown `target` and stop trying to reason about Node 18's V8. The "can't constrain Node API surface via types" limitation you documented is correct and industry-wide — the answer is what you already wrote: a Node-versions CI matrix, later. The `check-engines` script + `publishConfig.engines` split is a reasonable pattern; keep it.

One genuine simplification available if the two-config dance still bugs you: `isolatedDeclarations` + tsdown means `src` barely needs to be a _composite project_ at all — but do not touch this until after the Astro migration. It's cosmetic.

### c) Competitive assessment

Your doc is honest and technically accurate — rare for a self-assessment. Current market numbers (last-month npm downloads, June 2026): `astro-seo` ~382k, `@astrolib/seo` ~140k, `astro-seo-schema` ~72k. All component-based. Your differentiators remain exactly what the doc says: SSR-correct per-request state, merge-with-existing-template-tags, route filtering, request-context defaults — plus, now, the streaming-safe `Head` mode the doc didn't account for.

Honest read: you will not displace `astro-seo` for the median static blog, and that was never the bar. The bar you set in your own prompt — _"even if no one uses it when I ship, I will use it and it will be useful to me and I will have grown as an engineer"_ — is already met. The doc's positioning advice ("pagemeta is for metadata that Just Works site-wide; be honest about who shouldn't use it") is good README material; lift it nearly verbatim. Then stop reading the doc. Insecurity-driven re-analysis is a procrastination channel, and this audit is the last lap of it you need.

### d) Domain expertise — what's missing?

Your coverage via rehype-meta is respectable: title/description, canonical, OG + Twitter cards, article published/modified, section/tags, reading time, theme color, plus your additions (JSON-LD with `schema-dts` typing, charset/viewport injection, arbitrary `custom` tags with correct `property` vs `name` attribute handling — the OG-prefix list at `core.ts:25` shows you _did_ learn the domain). Gaps a metadata-savvy user would look for, in priority order:

1. **`robots` / noindex** — the most commonly needed tag you don't first-class. Already achievable via `custom: { robots: "noindex, nofollow" }`; needs a documented recipe, and is a candidate for a typed option later.
2. **i18n: `hreflang` alternates + `og:locale`** — genuinely absent, fine to declare out of scope for v1 (Astro's own i18n story would drive the design). Say so in docs.
3. **Icons/favicons, RSS `alternate` links** — conventionally handled in templates or by other tooling; a "what this integration deliberately doesn't do" docs section (sitemap → `@astrojs/sitemap`, robots.txt, favicons) would preempt the "does this person know the field?" judgment better than any feature would.
4. **OG image generation** — your original motivation, still on the roadmap; correct to sequence it after v1.
5. Nit: `addRequiredGlobalMeta`'s viewport default is `width=device-width` only; the overwhelmingly common value is `width=device-width, initial-scale=1`. Check rehype's output and consider matching convention.

Net: the project reads as domain-literate. What signals inexperience today isn't the tag coverage — it's stale docs and an Astro-5 peer dep. Both fixable without learning anything new.

## 5. The planning/ mess → a system you can restart from

Diagnosis first: you have **two planning systems** (`.plan/` = March-era design/debug notes; `planning/` = this week's brain-dump), and within `planning/`, must-do, should-do, someday-maybe, learning-wishlist, and testing-checklist items are interleaved in the same files. Reading it forces you to re-triage _everything_ every time — that's the blood-pressure spike. The fix is not more organization; it's **separation of altitude**: one ordered milestone file you work from, one backlog you're allowed to ignore.

### Proposed structure

```
planning/
├── ROADMAP.md      ← the ONLY file you open to decide what to do next
├── BACKLOG.md      ← everything else, unsorted, guilt-free
└── (archive the rest: MESS/RESUMING/TODO/pub/tsdown fold into the above; .plan/ → planning/archive/)
```

### The milestones (each independently shippable, do strictly in order)

**M0 — Re-entry (half a day, do it tomorrow).** Purpose: momentum, all-green baseline.

- Add `.claude/settings.local.json` to `.prettierignore`; add `bench/**/*.bench.ts` entries to `knip.json`
- Archive `.plan/` → `planning/archive/`; create ROADMAP.md/BACKLOG.md from this report
- Commit. Every check green. You are no longer "behind" — you're mid-roadmap.

**M1 — Ecosystem catch-up (the big one; 2–5 sessions).** Purpose: retire all upgrade risk _before_ polishing. Highest uncertainty, so it goes first.

- Bump `@inox-tools/astro-tests` → 1.0, catalog `astro` → 7, run suite, fix fallout
- Migrate off `astro-integration-kit` (small; see §2)
- Revisit `server.moduleGraph` invalidation under the new dev server; re-verify doctype/partial behavior under the Rust compiler (tests cover this)
- Decide + set real peer range; raise Node floor / tsdown target accordingly
- Exit criteria: suite green on the newest Astro major you intend to support

**M2 — Publish pipeline (2–3 sessions).** Purpose: the psychological unlock — a real package on npm.

- Changesets; GitHub Actions CI (lint/typecheck/test); npm publish with provenance; publint/attw enforced in CI
- Publish `0.1.0` (or a `next`-tagged beta). Verify `npm install` + registry rendering
- Exit criteria: you have run one full release cycle end-to-end and could do it again from memory

**M3 — Dogfood (1–2 sessions + soak time).** Install from npm into your portfolio site; run the playground manual checklist; fix paper cuts; release again (exercising the pipeline). This is also where the manual-testing checklist gets pruned to what actually caught anything.

**M4 — Docs & v1.** Fix the drift list in §3 (CLAUDE.md, MAINTENANCE.md, playground README); lift the positioning from competition-assessment.md into the README; add domain recipes (robots, "what we deliberately don't do"); Renovate; announce. Tag v1.

**BACKLOG.md (explicitly not now):** OG image generation service, dev toolbar integration, AI harness/skills work, blog posts, the LEARN reading list, eslint 10 / oxlint migration, Node/Astro CI matrices, satori experiments.

### Rules for the system (the part that actually fights the paralysis)

1. **Only ROADMAP.md is load-bearing.** BACKLOG.md has no obligations attached. If it's not in the current milestone, you're _supposed_ to ignore it.
2. **The LEARN list is not a prerequisite.** You wrote it as a wall to climb before shipping; treat it as reference material attached to milestones (e.g., read the Google special-tags doc when writing M4's recipes, not before starting M1).
3. **Session ritual:** open ROADMAP.md, do the next unchecked box, check it, commit, close. A session that checks one box is a success. The suite runs in 15 seconds — you always have a fast "is it still fine?" button, which is precisely the moving-faster-via-tests payoff you built it for.

---

## Appendix: file-by-file mapping of the old planning material

| Old file                                         | Disposition                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `planning/TODO.md`                               | Publishing items → M2; engines/TS questions → resolved by M1 decisions; renovate → M4                                                                                                                                          |
| `planning/MESS.md`                               | The "Outcomes" list at top = acceptance criteria spread across M1–M4 (nice work, keep as ROADMAP preamble); numbered list maps ~1:1 onto M2/M3/M4                                                                              |
| `planning/RESUMING.md`                           | Items 2–4 (Astro upgrade, integration-kit, deps) → M1; playground question → M3; ".plan being exhausting" → answered: archive it (M0)                                                                                          |
| `planning/pub.md`, `planning/tsdown.md`          | tsdown questions largely settled by the working config; remaining CI items → M2. The "do we even need to bundle" question: keep bundling — answer is yes while any supported Astro allows Node < 22... revisit at Astro-7-only |
| `planning/ai-audit.md`                           | This document covers it; delete                                                                                                                                                                                                |
| `planning/ai-harness.md`, `planning/blogging.md` | → BACKLOG                                                                                                                                                                                                                      |
| `.plan/*`                                        | Historical design/debug record — archive, don't delete (BUG_REPORT_INLINE_MOD.md and VITE_VIRTUAL_MODULES.md remain useful reference during M1)                                                                                |

### Sources

- [Astro 6.0 announcement](https://astro.build/blog/astro-6/) — Node 22+, Vite 7, dev server refactor on Environment API
- [Upgrade to Astro v7](https://docs.astro.build/en/guides/upgrade-to/v7/) — Vite 8, Rust compiler default, Sätteri markdown
- [astro-integration-kit migration guide](https://astro-integration-kit.netlify.app/migration-guide/) — deprecation path
- npm registry: `astro` dist-tags (latest 7.0.6), download counts for astro-seo / @astrolib/seo / astro-seo-schema
