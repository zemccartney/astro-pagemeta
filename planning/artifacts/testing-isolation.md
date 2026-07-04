# Why the Test Isolation System Exists — a reconstruction

_Written 2026-07-03 (Claude), from: current code, root `MAINTENANCE.md`, `maintenance/testing.md`, `vitest.config.ts` comments, git history, and dependency-tree checks. Purpose: memory-refresher for Zack before revisiting the system in M1; source material for post-release maintenance docs._

## TLDR

The test setup was shaped by **two separate problems** that got tangled together in memory:

1. **The inline-mod global registry problem** (historical) — forced "one build config per test file" and "integration config in test files, not fixture configs." **The library code that caused this no longer exists in the codebase.** The rules survive as possibly-vestigial folklore — worth an experiment in M1.
2. **Dev-server resource exhaustion under parallelism** (still real, never root-caused) — socket errors when many Astro dev servers/builds run concurrently. Patched with `maxWorkers: 3`, which works well enough (269 tests / 15s, no flakes observed in a cold full run on 2026-07-03).

`isolatedFixture()` itself solves a third, simpler thing that remains fully valid: **filesystem collisions** when parallel test files share a physical fixture directory.

## Problem 1 — inline-mod double registration (historical)

**What happened:** the integration originally served its virtual config module via `@inox-tools/aik-mod` / `@inox-tools/inline-mod` (the `defineModule`/`constExports` approach — see the now-stale "Virtual Module / Runtime Stub Sync" section of root `MAINTENANCE.md`). inline-mod keeps a **global module registry**. Registering the same module ID twice:

- **Build:** throws `"Module already defined"` → hence the strict rule _one integration configuration per build-test file_ (a second `fixture.build()` in the same process throws)
- **Dev:** silently overwrites → hence "multiple configs allowed in dev tests, but sequentially, and stop each server first" (a concurrently-running server A would start serving server B's config)

It also forced _fixture configs to never include the integration_ — if both the fixture's `astro.config.ts` and the test's inline config added pagemeta, `astro:config:setup` ran twice → double registration.

There was a detailed write-up in `.plan/BUG_REPORT_INLINE_MOD.md`; `.plan/` was never committed and has been deleted, so that document is gone. This section is the reconstruction.

**What changed:** the integration was later rewritten to serve `virtual:pagemeta/config` through a **hand-rolled Vite plugin** (`createConfigPlugin` in `src/index.ts`) whose state lives in a per-integration-instance closure — no global registry. Verified 2026-07-03: zero references to `inline-mod` / `aik-mod` / `defineModule` / `runtime-stub` anywhere in `src/`, `tests/`, or the dependency tree.

**Status: the root cause is gone; the constraints may be vestigial.** Unknown: whether `@inox-tools/astro-tests` itself imposes any same-process constraints independently. **M1 experiment:** in a scratch test file, run two `fixture.build()` calls with different pagemeta configs in one file, and put the integration in a fixture's `astro.config.ts` while also passing inline config. If both work, the file-organization rules can be relaxed and the test matrix potentially consolidated (fewer files, less ceremony). If not, document the _actual_ current constraint and its source.

## Problem 2 — dev-server socket errors (real, never root-caused)

**Symptoms:** intermittent `SocketError: other side closed` and `connect ECONNREFUSED` during dev-server tests. Worst in error-handling tests that intentionally trigger middleware 500s. Tests that fail in the full suite but pass in isolation were the signature.

**What's actually happening (best understanding, unconfirmed):**

- `@inox-tools/astro-tests`' `fetch()` goes over real HTTP (Undici) to a real `astro dev` server on a unique port per fixture
- Running many dev servers + builds concurrently exhausts something (sockets? fs watchers? CPU causing timeouts?) — never pinned down
- Separately, when a test triggers a middleware error, Astro's dev server sometimes closes the socket before flushing the full 500 response — plausibly an Astro dev-server timing bug, not a test-isolation issue at all

**Mitigations, in order of adoption:** `--no-file-parallelism` (reduced but didn't eliminate; slow) → **`maxWorkers: 3`** in `vitest.config.ts` (current; caps concurrent dev servers/builds; anecdotally also _faster_ — less thrash). Build-side tests are immune because `app.render()` is in-process, no HTTP.

**Status: patched, not understood.** Good enough to live with. **M1 check:** read the `@inox-tools/astro-tests` 1.0 changelog — if the harness changed transport or lifecycle handling, re-test whether `maxWorkers` is still needed before carrying it forward. (Zack's backlog idea — a virtual-fs / in-process test system that replaces real dev servers — would eliminate this class entirely.)

## What `isolatedFixture()` actually does (still valid regardless of the above)

50 lines (`tests/utils/isolated-fixture.ts`): copies a fixture from `tests/integration/fixtures/<name>` into a temp dir under `.test-tmp/` (filtering `.astro`/`dist`/`node_modules`), loads it, returns `cleanup()` + `inject()`.

Why each piece exists:

- **Copy-to-temp:** multiple test files reuse the same logical fixture _in parallel_. Without copies they'd race on the fixture's `dist/` (build outputs from static vs SSR runs colliding) and `.astro/` cache. This is a consequence of the deliberate test matrix (same logic verified across static/SSR × dev/build = up to 4 files touching one fixture), not of any bug.
- **Temp dirs _inside_ the project tree** (`.test-tmp/`, not `os.tmpdir()`): Vite walks up from the fixture root to resolve `node_modules` and workspace config — an external temp dir breaks module resolution.
- **`inject()`:** lets one shared fixture serve both rendering modes by adding mode-specific files at test time (e.g. `slug.ssr.astro` without `getStaticPaths` vs `slug.static.astro` with it) instead of maintaining near-duplicate fixtures.
- **The filter:** stale `.astro`/`dist` from a manually-run fixture would poison the copy.

## The design principle behind the redundancy (from `maintenance/testing.md`, still endorsed)

Test everything across static/SSR and dev/build not because failures are expected, but as **documentary proof** the library survives Astro's mechanical variety — an adversarial stance justified by the library hooking undocumented behavior (doctype stripping for partials) and four lifecycle stages. The 2026-07 audit's verdict: this is the project's biggest asset, and it's about to pay off in the Astro 6/7 migration. The cost worth trimming is _duplicated assertions_ between suites, never the matrix itself.

## Open questions for the M1 revisit

1. Do the one-build-per-file / no-integration-in-fixture-config rules still bind under the current custom Vite plugin + astro-tests 1.0? (Experiment above.)
2. Is `maxWorkers: 3` still necessary under astro-tests 1.0?
3. Can the socket-error-on-500 behavior be reproduced deliberately and reported upstream (Astro or astro-tests)?
4. If (1) relaxes: how much file consolidation is worth doing vs. leaving the working structure alone?

## Addendum 2026-07-03: harness will be vendored

Decision during M1 kickoff: rather than tracking `@inox-tools/astro-tests` releases (1.0 peers on `astro ^6.0.8` only, gating our Astro upgrades), we vendor the used surface — `astroFixture.ts` (~500 lines, public Astro APIs only) + `test-adapter.ts` — into our own tests/ tree with attribution. The "check the astro-tests 1.0 changelog" items above become "diff upstream when curious"; open questions 1–3 get answered against our own code, where the undici agent and server lifecycle are finally inspectable.
