# Roadmap

> **This is the only load-bearing planning file.** Work top to bottom, one milestone at a time.
> Anything not here lives in [BACKLOG.md](./BACKLOG.md) and carries zero obligation.
> Session ritual: open this file → do the next unchecked box → check it → commit → close. Full loop, including the pre-work "what right looks like" note and the review step: [maintenance/dev-process.md](../../maintenance/dev-process.md).
> Full context for these decisions: [the audit report](../audit/report.md). Folder map: [planning/README.md](../README.md).
> (`../scratch/` is Zack's personal scratchpad — agents read it, never write to it.)

**Destination:** `@grepco/ephemeris` (renamed from `@grepco/astro-pagemeta` on 2026-09-20) published to npm, maintained with confidence and low anxiety.

---

## M0 — Re-entry _(half a day; goal: momentum + all checks green)_

- [x] Add `.claude/settings.local.json` to `.prettierignore` (fixes `pnpm fmt`)
- [x] Add `bench/**/*.bench.ts` and `bench/fixtures/generate.ts` as entry points in `knip.json` (fixes `pnpm knip`)
- [x] Exclude frozen `image-gen-wip/` prototype from eslint/knip/prettier (surfaced when it moved out of the ignored `.plan/`)
- [x] Commit `planning/` (consolidated working docs) and `image-gen-wip/` (the seed for M5, don't lose it)
- [x] Verify: `pnpm lint && pnpm fmt && pnpm knip && pnpm typecheck && pnpm --filter @grepco/astro-pagemeta test` all green _(done 2026-07-03: 269/269 tests, all checks pass)_

**✅ Completed 2026-07-03.**

**Exit criteria:** clean working tree, every check passes, one commit.

## M1 — Ecosystem catch-up _(2–5 sessions; highest uncertainty, so it goes first)_

Astro shipped v6 (2026-03: Node 22+, Vite 7, dev server on Vite Environment API) and v7 (2026-06: Vite 8, Rust compiler default) while the project was paused. Full change summary + the tests they imply: [../artifacts/astro-6-7-changes.md](../artifacts/astro-6-7-changes.md). Test-system refresher before touching the suite: [../artifacts/testing-isolation.md](../artifacts/testing-isolation.md).

_Decisions from deps-security.md folded in first (2026-07-03, scratch/m1.md) as guardrails: 7-day release age + workspace-wide `deps` script ✓ done; ranges kept; Renovate/Socket/OIDC land in M2/M4. **Astro v5 support dropped** (see policy below)._

- [x] Baseline deps state via `pnpm deps` dry-run (2026-07-03): pagemeta package → astro-tests 1.0, aik 0.20 (moot — being removed), schema-dts 2, vitest 4.1, attw/publint patches; root → eslint-10 family, pnpm 11; catalog → tsdown 0.22, typescript 6. All majors need changelog reads during the upgrade session.
- [x] **Vendor the test harness** _(done 2026-07-04: new private workspace package `@grepco/astro-fixture` — `astro-fixture.ts` + `test-adapter.ts` vendored from `@inox-tools/astro-tests@0.8.1` with provenance headers, trimmed to the 7-method surface the suite uses, `debug`/`fast-glob`/`@inox-tools/utils` deps eliminated (only `undici` remains), full conventions applied. Suite green 269/269 at Astro 5.18 with zero test changes beyond import paths. See `packages/astro-fixture/README.md` for the two-upstream diff recipe (astro test-utils at release tags = source of truth; inox-tools = packaging fixes).)_
- [x] Non-Astro dep updates _(done 2026-07-04: eslint 10 family (astro 2, jsdoc 63, package-json 1.5, config-inspector 3, `@eslint/compat` dropped — `includeIgnoreFile` now lives in `eslint/config`), typescript-eslint ^8.61.1 (8.62.1 blocked by our own 7-day gate — working as intended), vitest 4.1, schema-dts 2, tsdown 0.22, attw/publint patches, lefthook. **Node 24.12 → 24.18 via fnm** (eslint-plugin-astro@2 requires ^24.16). Deferred deliberately: pnpm 11 (lockfile-format blast radius — own step), @astrojs/node 11 (Astro-6-coupled), @types/node 26 (stays aligned to dev Node 24), unicorn 69/knip 6/ncu 22 (cooldown-ignored — retry next cycle). 269/269 green.)_
- [x] TypeScript 6 _(done 2026-07-12 on the Astro 7 leg as planned → TS 6.0.3: the TS≤5-peered internals (`tsconfck`, `zod-to-ts`) left astro's tree in 7. Only fallout was not TS 6 semantics but a vite 7/8 **type** mismatch in `astro:server:setup` (our types-only `vite` dev dep lagged astro 7's Vite 8) — aligned to `^8.0.0`. Typecheck + eslint + 278/278 green.)_
- [x] Bump catalog `astro` → `^6` _(done 2026-07-04 → astro 6.4.8: **one source change in the whole major** — `compressHTML` widened to `boolean | "jsx"` (6.2+), mapped truthy→minify. Vendored harness unmodified; doctype/partial detection holds (Go compiler default in 6); moduleGraph invalidation + route filtering pass. Stance landed: peer `^6.0.0`, engines `>=22.12.0` (check:engines-verified), lib es2023, tsdown target node22, README Prerequisites, `maintenance/support.md` with upgrade playbook. `@astrojs/node` → ^10 (v11 = astro 7 line). 269/269 green; playground SSR build clean.)_
    - Watch: `server.moduleGraph` invalidation (`src/index.ts` — Environment API refactor lands in 6); `astro:routes:resolved` / `addMiddleware` / `compressHTML` still behave; 6.1's i18n fallback routes in route filtering. Compiler note: 6 still defaults to the Go compiler (Rust is opt-in experimental), so doctype/partial behavior shouldn't shift yet — optionally preview the Rust compiler behind its flag here.
- [x] **CSP compatibility** _(done 2026-07-05; revised same day after Zack's review caught two overclaims)_: `tests/integration/csp/` recomputes sha256 hashes from final post-middleware HTML and asserts direct match against Astro's delivered policy. Verified against 6.4.8: static → CSP meta (entity-encoded quotes are semantics-preserving), on-demand → CSP header, dev → no CSP at all, JSON-LD exempt (data block). **Revisions:** the CSP hard error was removed — `custom` cannot emit `http-equiv` (invariant), so a CSP key was always inert; stance is now docs-only (usage.md pragma + CSP notes). The Content-Length "bug" was never reproduced (probed streaming + non-streamed renders: no Astro 6.4.8 path sets it) — header-drop kept as defensive hygiene, test reframed as an explicit canary. http-equiv support: A-now-B-later decision, design parked in BACKLOG. Browser ground-truth CSP check added to playground M3 checklist. 278/278.
- [x] Bump catalog `astro` → `^7` _(done 2026-07-12 → astro 7.0.6, three fallout fixes: **(1)** astro-fixture now hides `process.env.VITEST` during `dev()` startup — Astro 7's vite-plugin-astro-server bails out of `configureServer` when VITEST is set (a guard for getViteConfig-style component tests), leaving real dev servers handlerless (every fetch 404s "Cannot GET /"); **(2)** `Head.astro` injects via a child `<Fragment set:html>` — the Rust compiler special-cases `<head>` and silently drops `set:html` on the element itself (rendered an empty head); **(3)** style-survival test regexes made whitespace-tolerant — Astro 7 dev serves scoped styles pretty-printed (Lightning CSS) where 6 minified. **Rust-compiler doctype/partial contract re-verified**: route-filtering + partial tests green, CSP hash sentries pass. `@astrojs/node` ^11 in playground; playground build + check clean. Suite ~14s under 7 vs ~21s under 6 (Rolldown). Vendored-harness upstream diff not needed — fallout was env-guard + compiler behavior, not harness API drift.)_
- [x] Migrate off deprecated `astro-integration-kit` _(done 2026-07-04, at Astro 5 before the bump: `defineIntegration`/`optionsSchema` → plain factory + hand-rolled `validateOptions` (same shapes/defaults, `[pagemeta]`-prefixed errors — also removes the `astro/zod` usage, eliminating the zod 3→4 variable from the Astro 6 upgrade); `createResolver` → `node:path`/`node:url` resolve; `addVitePlugin` → `updateConfig`. Test-only aik usage in `error-capture` migrated the same way. 269/269 green, all checks pass.)_
    - ⚠️ Discovery for M2 scratch-install verification: auto-mode's middleware entrypoint resolves `./middleware.js`, but `dist/` emits `middleware.mjs`. Tests import from `src/` (Vite rewrites `.js`→`.ts`) and the playground runs `mode: "manual"`, so the dist path may never have been exercised. Behavior replicated faithfully — verify from a real install in M2, and if broken, align tsdown out-extensions or the entrypoint.
- [x] Set `peerDependencies.astro` to `^6.0.0 || ^7.0.0` _(widened 2026-07-12 after verifying HEAD 278/278 on **both** 6.4.8 (scratch worktree) and 7.0.6 — the Head Fragment form and VITEST fix are compatible with both compilers. support doc + README prerequisites updated; Node floor identical on both majors.)_
- [x] Node floor `>=22.12.0` + check-engines + tsdown target node22 _(landed with the Astro 6 bump)_
- [x] README Prerequisites section _(landed with the Astro 6 bump)_
- [x] Support-stance maintenance doc → `maintenance/support.md` _(landed with the Astro 6 bump)_
- [x] All tests and static checks pass _(278/278 on astro 6.4.8 **and** 7.0.6 as of 2026-07-12)_

**M1 exit criteria: met (2026-07-12).** Suite green on Astro 6 and 7 via the vendored harness; integration-kit gone; peer `^6.0.0 || ^7.0.0` + engines `>=22.12.0`; stance in `maintenance/astro-node-support.md` + README prerequisites. → M2.

**Version-support policy (DECIDED 2026-07-03, refined per Zack): align with [Astro's own stated support matrix](https://docs.astro.build/en/upgrade-astro/#nodejs-support-and-upgrade-policies), transitively.**

1. **Astro majors:** support the majors Astro itself maintains — the current major plus the previous (security-fixes-only) major. Today: 6 + 7.
2. **Node:** adopt Astro's Node policy as ours — "the latest _Maintenance_ LTS and the current _Active_ LTS" (their exact scope, including their rules for when floors move: Maintenance-LTS bumps in minors, major Node bumps in majors). Our `engines` mirrors the supported Astro majors' effective floor (today `>=22`), and integration code uses only Node/Astro features within that matrix.
3. **Statement to users:** "This integration supports the Astro versions Astro supports, on the Node versions Astro supports." One sentence, always true, self-updating in spirit — the README/maintenance doc lists the current concrete versions with a link to Astro's policy.
4. Older Astro majors (e.g. 5): out, because they fall outside Astro's own matrix — v5 is unmaintained upstream and floors on EOL Node (18/20). Re-evaluate at each Astro major; drops happen in a pagemeta major release, noted in the changelog.

**Exit criteria:** suite green on Astro 6 and 7 via the vendored harness; integration-kit gone; peer `^6.0.0 || ^7.0.0` (or exactly what passes) + engines `>=22`; stance written into MAINTENANCE docs + README prerequisites.

## M2 — Publish pipeline + CI foundation _(2–3 sessions; goal: a real package on npm)_

- [x] GitHub Actions CI: lint, fmt, knip, typecheck, test _(workflow authored 2026-07-13; **first green run 2026-09-19, run 35477040704**, after two red runs taught three things now baked into `ci.yml` comments: `typecheck` must precede `lint` because lint resolves our own exports to `dist/*.d.mts`; tsdown deprecations are fatal in CI via `failOnWarn: "ci-only"`; pnpm enforces workspace `engines` on `pnpm run`, so the floor leg calls vitest's bin. The first red run also surfaced a critical Astro advisory (<7.2.8) — fixed by the deps refresh below.)_
- [x] **Astro × Node test matrix** _(all three legs green 2026-09-19 on the same run. Design settled: every leg installs on the toolchain Node 24; the floor leg switches to 22.12 only to run the suite — the published floor is a runtime claim, the dev floor a toolchain one, and `publishConfig.engines` exists precisely because they differ. Recipe caveat: `use-astro` restore resets three files to HEAD, so commit deps changes first.)_:
    - Matrix legs (in the workflow): astro 7 × node 24 (default), astro 6 × node 24, astro 7 × node 22.12 (published floor)
    - Mechanism: `scripts/use-astro.ts` (`pnpm use-astro 6`) — rewrites the `astro` catalog entry **and** the playground's coupled `@astrojs/node` range, then `pnpm install --no-frozen-lockfile`; restore with `git restore pnpm-workspace.yaml playground/package.json pnpm-lock.yaml && pnpm install`. Verified locally round-trip 7→6→7 with a smoke test on 6.
    - Node versions: `actions/setup-node` matrix in CI; `mise`/`nvm` locally
- [ ] Supply-chain baseline in CI (decisions in [deps-security.md](./deps-security.md)): ~~pin all GitHub Actions to commit SHAs; add audit step~~ _(both live since 2026-07-13 / green 2026-09-19)_; Socket (or chosen alternative) on PRs — _Zack wants to understand supply-chain security and responsible publishing before automating (2026-09-19); pair this with a written explainer, not just config_

_2026-09-19 re-entry tranche (5 commits, b6c55f9..047be93):_ **deps refresh** (`pnpm update -r`; astro 7.3.2, undici 7.29, eslint 10.10, ts-eslint 8.70, vitest 4.1.11, prettier 3.9; audit clean; majors deferred to BACKLOG: TS 7, undici 8, tsdown 0.23). **Astro 7.3 dev regression found and fixed:** 7.3.0's `astro/middleware` entry imports the ambient manifest, so each dev request's manifest invalidation re-evaluates any module importing it — our runtime bundle got fresh instances per page while the middleware kept the old one, and the private `Symbol("pagemeta")` diverged (five dev tests silently fell back to defaults; bisected 7.2.10 ✓ / 7.3.0 ✗; traced with a Vite module-graph probe). Fix: `Symbol.for("@grepco/astro-pagemeta")` + a unit test that evaluates `core.ts` twice. Follow-ups (upstream report, dropping the runtime `astro/middleware` import) in BACKLOG. **Process:** `maintenance/dev-process.md` is now the canonical loop; CLAUDE.md corrected (exports → `dist/`, `pretest` builds).

- [ ] Changesets: install, wire release workflow, write first changeset
- [ ] npm publish with provenance; keep publint + attw enforced in the build _(attw `/Head` annotation done 2026-07-13: `excludeEntrypoints: ["Head"]` in tsdown.config.ts with rationale comment — the .astro entrypoint's types come from Astro tooling, not a .d.ts, and the inert warning would have failed CI under `failOnWarn: "ci-only"`)_
- [ ] Rewrite `packages/astro-fixture/README.md` for public repo consumption (currently references `planning/` docs and pre-publish context that won't survive the planning-folder deletion)
- [ ] Publish `0.1.0` (or `0.1.0-beta` under `next` tag) — verify `npm install` from a scratch project + registry page rendering; confirm `publishConfig.engines` actually lands in the published manifest (`npm view`)

_2026-09-20 rename tranche (4 commits, 1d2f5c7..f8884d9):_ **the package is `@grepco/ephemeris`.** Zack picked the name (an ephemeris is the published table of where the bodies will be; pages declare their metadata, the table lands in the rendered `<head>`). Done as four mechanical commits so each is a single greppable substitution: directory move (`packages/ephemeris`), package name + every import specifier (also moves the locals key to `Symbol.for("@grepco/ephemeris")`), identifiers (`ephemeris()` integration, `virtual:ephemeris/config`, `[ephemeris]` error prefix, `<Ephemeris>` playground alias), then docs. `planning/`, `competition-assessment.md` and `image-gen-wip/` deliberately keep the old name as history. **Verified:** all static checks green per commit; 279/279 on Astro 7.3.2 after the docs commit; Astro 6 leg left to CI. **Follow-up, same day:** Zack renamed the GitHub repo and local folder; the three manifest URLs and the git remote now point at `zemccartney/ephemeris`. The M4 doc-drift item still applies.

**Exit criteria:** one full release cycle executed end-to-end; you could run the next one from memory.

## M3 — Dogfood _(1–2 sessions + soak time)_

- [ ] Install from npm into the portfolio site; take before/after snapshots of pages
- [ ] Run the playground manual checklist (`playground/README.md`); prune it to checks that earn their keep
- [ ] Fix paper cuts found; release again (exercises the pipeline a second time)
- [ ] Sanity checks from old TESTING notes worth keeping: OG validators, Google Rich Results, `astro add` install path, editor go-to-definition / typecheck feel, JSDoc showing in IntelliSense

**Exit criteria:** pagemeta running in production on a real site you own; second release shipped.

## M4 — Docs, maintenance routine & v1

- [ ] Fix doc drift: `CLAUDE.md` (6 source files, current test layout, `mode`/`Head`), root `MAINTENANCE.md` (describes removed runtime-stub/aik-mod system), `playground/README.md` (path + `<Pagemeta>` → `Head`), `maintenance/tsconfig.md` (stale eslint-globals note; revise post-M1 simplifications)
- [ ] README: lift positioning from `planning/plan/competition-assessment.md` (moved out of the root 2026-09-20 so the public repo states its own value instead of comparing; keep it private with the rest of `planning/`) (incl. "who should NOT use this"); add domain recipes — `robots`/noindex via `custom`, "what this deliberately doesn't do" (sitemap → `@astrojs/sitemap`, robots.txt, favicons, hreflang)
- [ ] Consider: viewport default → `width=device-width, initial-scale=1`; escape `<` in JSON-LD output (`</script>` breakout hardening)
- [ ] Dependency routine live (per [deps-security.md](./deps-security.md)): Renovate (or scheduled ncu) with cooldown, auto-merge rules, CVE alerting; fix root `deps` script to cover all workspace packages
- [ ] Write the maintenance runbook: how to release, how to update deps, how to test an Astro major bump — the "how do I run things myself" doc
- [ ] Tag v1.0.0, publicize (Astro Discord #showcase; verify presence/display on the Astro integrations catalog)

**Exit criteria:** a stranger (or you, after 3 months off) can orient from the docs alone; maintenance is a routine, not a research project.

## M5 — OG image generation _(future; the original itch)_

Seed: `image-gen-wip/` (earliest prototype — generating og-images during Astro builds).
Shape (from planning notes): a pluggable system for image generators that hooks into pagemeta — specify how to create OG images for pages using the integration; build one generator for yourself (satori?) + docs for writing your own. Design work starts only after v1.

---

_Changelog: created 2026-07-03 from the audit (../audit/); supersedes the notes now archived in ../scratch/ as the working plan (preserved as a record)._
