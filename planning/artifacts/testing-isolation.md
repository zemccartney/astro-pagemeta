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

**Status: patched, not understood.** Good enough to live with. **M1 check:** read the `@inox-tools/astro-tests` 1.0 changelog — if the harness changed transport or lifecycle handling, re-test whether `maxWorkers` is still needed before carrying it forward. (What would eliminate this error class is **in-process request dispatch** — calling the dev server's handler directly instead of real HTTP over undici/TCP — one of the harness ideas in BACKLOG. Virtual-fs, a separate idea often mentioned alongside it, only replaces fixture disk copies and does nothing for sockets. _Corrected 2026-07-05 — an earlier version of this sentence conflated the two._)

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

## Addendum 2026-07-05: suite slowdown under Astro 6 — measured, contention-bound

Symptom (Zack): full-suite wall time roughly doubled after the Astro 6 bump (~15s → consistently 30-40s).

Measurements (M3, 8 cores, 16 GB, maxWorkers as noted):

| Config                                   | Wall  | Cumulative test time |
| ---------------------------------------- | ----- | -------------------- |
| Astro 5 baseline (2026-07-03, 269 tests) | 15.4s | 29.8s                |
| Astro 6, maxWorkers=2 (278 tests)        | 40.3s | 65.6s                |
| Astro 6, maxWorkers=3                    | ~37s  | 92.3s                |
| Astro 6, maxWorkers=5                    | 36.8s | 148.9s               |

Solo timings under Astro 6 are fast (instrumented probe: loadFixture 22ms, dev-server start 550ms, first fetch 101ms, build 1.1s; heaviest file solo 4.5s vs 8.2s in-suite). Conclusion: not our code, not `.test-tmp` junk (17 dirs / 68K) — **Astro 6 operations parallelize worse**, so concurrent workers contend hard: wall time is pinned ~33-40s at any worker count while cumulative CPU scales with workers. A small part is legitimate growth (+2 CSP test files ≈ +3 Astro ops).

_Root-cause follow-up 2026-07-05 (Zack asked how the "Environment-API dev server" attribution was reached — it was inference, not measurement; these discriminating runs replace it):_

| Run (`/usr/bin/time -l`, CPU = user+sys incl. children) | Wall  | CPU    | Effective cores |
| ------------------------------------------------------- | ----- | ------ | --------------- |
| Full suite, maxWorkers=3                                | 33.5s | 138.5s | 4.1             |
| Dev-server tests only (`-t "dev server"`, 110 tests)    | 16.5s | 62.7s  | 3.8             |
| Build tests only (`-t "/ build"`, 67 tests)             | 15.2s | 60.7s  | 4.0             |
| Full suite, serialized (maxWorkers=1)                   | 63.0s | 108.7s | 1.7             |
| Full suite, maxWorkers=3, GOMAXPROCS=3                  | 35.4s | 140.8s | 4.0             |

- **Environment-API dev server attribution: refuted.** Build tests (no dev server) contend identically to dev-server tests. The shared resource is in the astro+vite core pipeline both paths use.
- **Not machine CPU/memory saturation:** 4.1 of 8 cores average, max RSS <800MB/process — which is why more workers never helped.
- **Mechanism (best supported):** ops are internally parallel and _bursty_ — a lone chain averages 1.7 cores (single-threaded stretches, incl. ~11s cumulative per-file world re-import under vitest isolate mode, punctuated by multi-threaded bursts). Concurrent ops collide during bursts while cores idle in the stretches: per-op cumulative inflates 49.5s → 81.2s → 148.9s at 1 → 3 → 5 workers, wall stays pinned.
- **Burst source not pinned:** esbuild ruled out (GOMAXPROCS cap a no-op). Untested suspects: Rollup 4 native parser threads, Vite 7 worker threads, libuv threadpool (`UV_THREADPOOL_SIZE`), kernel/fs (sys = 15-20% of CPU).
- **Open caveat:** no Astro 5 _serialized_ baseline exists, so "unit cost didn't grow" is only established in absolute terms; some genuine per-op 5→6 growth is likely mixed in. Splitting it needs a pre-bump-commit maxWorkers=1 run. _(Resolved by the 2026-07-06 bisection below: unit cost roughly doubled.)_

_Bisection 2026-07-06 (Zack asked which M1 changes contributed): each M1 leg checked out into a scratch worktree, `pnpm install` + `pnpm build`, suite run twice under that commit's own config (maxWorkers=3, forks, isolate:true; 269 tests on all legs). Second/steadier run shown:_

| Leg (commit)                               | Wall  | Tests cumulative |
| ------------------------------------------ | ----- | ---------------- |
| Baseline: Astro 5 + inox harness (723889b) | 14.4s | 26.7s            |
| + harness vendored (162725a)               | 16.4s | 33.2s            |
| + aik removed (38e8862)                    | 18.0s | 36.7s            |
| + deps updated, vitest 4.0→4.1 (d35ae9e)   | 17.4s | 36.1s            |
| + Astro 6 (fb29acd)                        | 26.2s | 59.2s            |

Serialized (maxWorkers=1): Astro 5 baseline **32.5s wall / 20.1s tests-cum** vs Astro 6 **52.5s / 40.7s**.

- **Astro 6 is the dominant factor** (+9s wall, +25s cumulative), and — **correcting the 07-05 "not unit Astro cost" conclusion** — the serialized comparison shows **per-op cost roughly doubled** from Astro 5 to 6. The contention inflation (mw3-vs-serial cumulative) only worsened modestly: 1.33× → 1.55×. Yesterday's "solo ops are fast" was absolute, not comparative — 550ms/1.1s is fast, but the A5 equivalents were ~half that.
- **Harness vendoring cost ~2s** — mostly because the vendored harness is TS compiled in-worker by vitest (transform bucket 0.3s → 3.4s cumulative), where inox shipped prebuilt JS. Fixable by building astro-fixture with tsdown if ever worth it.
- **aik removal and dep updates: noise-level** (±1.5s run-to-run variance).
- Incidental find: package exports resolve `./runtime` from `dist/`, and only the `pretest` hook (`tsdown`) keeps it fresh — direct `vitest` invocations (IDE/watch) can run against a stale build. Flagged for the M2 dist-mismatch item.

Disposition: keep `maxWorkers: 3` (least-bad; documented in vitest.config.ts). The cost is per-`dev()`/`build()` **pipeline instantiation** (full astro+vite machinery per fixture, in-process in the workers — there are no separate server processes), so the only lever that attacks contention is **fewer instantiations per run**: sharing fixtures/servers across test files, or consolidating dev-server files — both against the matrix/isolation philosophy, so not now. The BACKLOG harness ideas don't help here: in-process request dispatch removes the TCP/undici layer (socket-error class, ~100ms/first-fetch), and virtual-fs removes fixture disk copies (measured negligible: 68K) — neither touches instantiation cost. Re-measure at the Astro 7 leg (Rolldown + queued rendering may shift this again).

_Config update 2026-07-06 (Zack): `isolate: false` (33.5s → ~25s — kills the per-file world re-import) and `pool: "threads"` (→ ~21s — cheaper workers than forked processes). Kept after green runs; watch for cross-file module-state leaks (harness mutates `process.env.NODE_ENV` per op; `nextDefaultPort` is module-level) and native-addon quirks under worker threads._
