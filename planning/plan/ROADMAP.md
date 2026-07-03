# Roadmap

> **This is the only load-bearing planning file.** Work top to bottom, one milestone at a time.
> Anything not here lives in [BACKLOG.md](./BACKLOG.md) and carries zero obligation.
> Session ritual: open this file → do the next unchecked box → check it → commit → close.
> Full context for these decisions: [the audit report](../audit/report.md). Folder map: [planning/README.md](../README.md).
> (`../scratch/` is Zack's personal scratchpad — agents read it, never write to it.)

**Destination:** `@grepco/astro-pagemeta` published to npm, maintained with confidence and low anxiety.

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

- [ ] Bump `@inox-tools/astro-tests` 0.8.1 → 1.0.0; read its changelog for harness changes (double-registration / socket-error quirks may be fixed — check before working around them again)
- [ ] Bump catalog `astro` → `^7`, run full suite, fix fallout
    - Watch: `server.moduleGraph` invalidation (`src/index.ts` — Environment API deprecates it); doctype/partial detection under the Rust compiler (route-filtering tests cover it); `astro:routes:resolved` / `addMiddleware` / `compressHTML` still behave
- [ ] Migrate off deprecated `astro-integration-kit` ([migration guide](https://astro-integration-kit.netlify.app/migration-guide/)). Replaces: `defineIntegration`, `optionsSchema`/`astro/zod`, `createResolver`, `addVitePlugin` — all thin wrappers over plain Astro APIs. (Supply-chain note, corrected 2026-07-03: this sheds only `astro-integration-kit` + `pathe`. The "293 packages under aik" that `pnpm ls` shows is Astro itself resolved as a peer — consumers have it anyway. Honest numbers in [deps-security.md](./deps-security.md) Pillar 1.)
- [ ] Test back-compat: does the same code pass against Astro 6? Against 5? (Use the version-switch script from M2 prep, or a throwaway `pnpm add astro@^6` + test run)
- [ ] **Decide and record the version-support policy** (see below) and set `peerDependencies.astro` to exactly the range CI will prove
- [ ] Raise Node floor to match: if v5 support kept, keep `publishConfig.engines` as-is; if 6+ only, simplify to `>=22` and bump tsdown `target`

**Version-support policy (proposed — confirm during M1):**
Astro's own policy is security-fixes-for-one-previous-major only (today: 7 current, 6 maintained, 5 unmaintained). Ours:

1. First-class support = every Astro major that Astro itself still maintains (currently 6 + 7). These run in CI, bugs against them get fixed.
2. Older majors (5): supported only while it's free — i.e., the same code passes their CI leg without forks or workarounds. When it stops being free, drop the major **in a pagemeta major release** (semver-honest), noted in the changelog.
3. Re-evaluate on every Astro major release, case by case: cost of compat vs. benefit of new APIs. No standing promise beyond the current peer range.

**Exit criteria:** suite green on Astro 7 (+ 6, + 5 if free); integration-kit gone; peer range and engines reflect reality; policy written into MAINTENANCE docs.

## M2 — Publish pipeline + CI foundation _(2–3 sessions; goal: a real package on npm)_

- [ ] GitHub Actions CI: lint, fmt, knip, typecheck, test
- [ ] **Astro × Node test matrix** (see [deps-security.md](./deps-security.md) §CI for the local-testing story):
    - Matrix legs: newest Astro major × newest Node LTS (the default), plus one leg per additional supported Astro major, plus supported-Node floor × newest Astro
    - Mechanism: small script that rewrites the `astro` catalog entry in `pnpm-workspace.yaml` + `pnpm install --no-frozen-lockfile`; same script works locally (`node scripts/use-astro.mjs 6 && pnpm test`, then `git restore pnpm-workspace.yaml pnpm-lock.yaml`)
    - Node versions: `actions/setup-node` matrix in CI; `mise`/`nvm` locally
- [ ] Supply-chain baseline in CI (decisions in [deps-security.md](./deps-security.md)): pin all GitHub Actions to commit SHAs; add audit step; Socket (or chosen alternative) on PRs
- [ ] Changesets: install, wire release workflow, write first changeset
- [ ] npm publish with provenance; keep publint + attw enforced in the build (attw: add explicit ignore/annotation for the `/Head` .astro export warning)
- [ ] Publish `0.1.0` (or `0.1.0-beta` under `next` tag) — verify `npm install` from a scratch project + registry page rendering; confirm `publishConfig.engines` actually lands in the published manifest (`npm view`)

**Exit criteria:** one full release cycle executed end-to-end; you could run the next one from memory.

## M3 — Dogfood _(1–2 sessions + soak time)_

- [ ] Install from npm into the portfolio site; take before/after snapshots of pages
- [ ] Run the playground manual checklist (`playground/README.md`); prune it to checks that earn their keep
- [ ] Fix paper cuts found; release again (exercises the pipeline a second time)
- [ ] Sanity checks from old TESTING notes worth keeping: OG validators, Google Rich Results, `astro add` install path, editor go-to-definition / typecheck feel, JSDoc showing in IntelliSense

**Exit criteria:** pagemeta running in production on a real site you own; second release shipped.

## M4 — Docs, maintenance routine & v1

- [ ] Fix doc drift: `CLAUDE.md` (6 source files, current test layout, `mode`/`Head`), root `MAINTENANCE.md` (describes removed runtime-stub/aik-mod system), `playground/README.md` (path + `<Pagemeta>` → `Head`), `maintenance/tsconfig.md` (stale eslint-globals note; revise post-M1 simplifications)
- [ ] README: lift positioning from `competition-assessment.md` (incl. "who should NOT use this"); add domain recipes — `robots`/noindex via `custom`, "what this deliberately doesn't do" (sitemap → `@astrojs/sitemap`, robots.txt, favicons, hreflang)
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
