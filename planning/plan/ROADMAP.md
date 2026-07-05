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

_Decisions from deps-security.md folded in first (2026-07-03, scratch/m1.md) as guardrails: 7-day release age + workspace-wide `deps` script ✓ done; ranges kept; Renovate/Socket/OIDC land in M2/M4. **Astro v5 support dropped** (see policy below)._

- [x] Baseline deps state via `pnpm deps` dry-run (2026-07-03): pagemeta package → astro-tests 1.0, aik 0.20 (moot — being removed), schema-dts 2, vitest 4.1, attw/publint patches; root → eslint-10 family, pnpm 11; catalog → tsdown 0.22, typescript 6. All majors need changelog reads during the upgrade session.
- [x] **Vendor the test harness** _(done 2026-07-04: new private workspace package `@grepco/astro-fixture` — `astro-fixture.ts` + `test-adapter.ts` vendored from `@inox-tools/astro-tests@0.8.1` with provenance headers, trimmed to the 7-method surface the suite uses, `debug`/`fast-glob`/`@inox-tools/utils` deps eliminated (only `undici` remains), full conventions applied. Suite green 269/269 at Astro 5.18 with zero test changes beyond import paths. See `packages/astro-fixture/README.md` for the two-upstream diff recipe (astro test-utils at release tags = source of truth; inox-tools = packaging fixes).)_
- [x] Non-Astro dep updates _(done 2026-07-04: eslint 10 family (astro 2, jsdoc 63, package-json 1.5, config-inspector 3, `@eslint/compat` dropped — `includeIgnoreFile` now lives in `eslint/config`), typescript-eslint ^8.61.1 (8.62.1 blocked by our own 7-day gate — working as intended), vitest 4.1, schema-dts 2, tsdown 0.22, attw/publint patches, lefthook. **Node 24.12 → 24.18 via fnm** (eslint-plugin-astro@2 requires ^24.16). Deferred deliberately: pnpm 11 (lockfile-format blast radius — own step), @astrojs/node 11 (Astro-6-coupled), @types/node 26 (stays aligned to dev Node 24), unicorn 69/knip 6/ncu 22 (cooldown-ignored — retry next cycle). 269/269 green.)_
- [ ] TypeScript 6 — attempted 2026-07-04; works empirically but **deferred to the Astro 7 leg**: the TS≤5-peered internals (`tsconfck` — no TS-6-supporting release exists upstream — and `zod-to-ts`) ship unchanged in Astro 6.4.8, but **Astro 7 dropped both from its tree** (verified via npm), so TS 6 lands naturally there.
- [x] Bump catalog `astro` → `^6` _(done 2026-07-04 → astro 6.4.8: **one source change in the whole major** — `compressHTML` widened to `boolean | "jsx"` (6.2+), mapped truthy→minify. Vendored harness unmodified; doctype/partial detection holds (Go compiler default in 6); moduleGraph invalidation + route filtering pass. Stance landed: peer `^6.0.0`, engines `>=22.12.0` (check:engines-verified), lib es2023, tsdown target node22, README Prerequisites, `maintenance/support.md` with upgrade playbook. `@astrojs/node` → ^10 (v11 = astro 7 line). 269/269 green; playground SSR build clean.)_
    - Watch: `server.moduleGraph` invalidation (`src/index.ts` — Environment API refactor lands in 6); `astro:routes:resolved` / `addMiddleware` / `compressHTML` still behave; 6.1's i18n fallback routes in route filtering. Compiler note: 6 still defaults to the Go compiler (Rust is opt-in experimental), so doctype/partial behavior shouldn't shift yet — optionally preview the Rust compiler behind its flag here.
- [x] **CSP compatibility** _(done 2026-07-05, from Zack's triage; sequenced before 7 so the tests sentry the compiler swap)_: hard error on CSP-via-`custom` (config-time for static defaults, request-time otherwise, pointing at Astro's `security.csp`); `tests/integration/csp/` recomputes sha256 hashes from final post-middleware HTML and asserts they match Astro's policy. Verified against 6.4.8: static → CSP meta (entity-encoded quotes are semantics-preserving), on-demand → CSP header, dev → no CSP at all, JSON-LD exempt (data block). **Bonus bug fixed:** Astro sets Content-Length on non-streamed SSR responses; middleware was carrying the stale value onto the longer rewritten body (strict clients would truncate) — now dropped, statusText preserved, regression-tested. 284/284.
- [ ] Bump catalog `astro` → `^7` (unblocked by vendored harness), fix fallout — this is where the Rust-compiler doctype/partial re-verification actually happens; retry TypeScript 6 here too (its blockers left astro's tree in 7)
- [x] Migrate off deprecated `astro-integration-kit` _(done 2026-07-04, at Astro 5 before the bump: `defineIntegration`/`optionsSchema` → plain factory + hand-rolled `validateOptions` (same shapes/defaults, `[pagemeta]`-prefixed errors — also removes the `astro/zod` usage, eliminating the zod 3→4 variable from the Astro 6 upgrade); `createResolver` → `node:path`/`node:url` resolve; `addVitePlugin` → `updateConfig`. Test-only aik usage in `error-capture` migrated the same way. 269/269 green, all checks pass.)_
    - ⚠️ Discovery for M2 scratch-install verification: auto-mode's middleware entrypoint resolves `./middleware.js`, but `dist/` emits `middleware.mjs`. Tests import from `src/` (Vite rewrites `.js`→`.ts`) and the playground runs `mode: "manual"`, so the dist path may never have been exercised. Behavior replicated faithfully — verify from a real install in M2, and if broken, align tsdown out-extensions or the entrypoint.
- [x] Set `peerDependencies.astro` to `^6.0.0` _(landed with the Astro 6 bump; extend to `^6.0.0 || ^7.0.0` only when the 7 leg passes)_
- [x] Node floor `>=22.12.0` + check-engines + tsdown target node22 _(landed with the Astro 6 bump)_
- [x] README Prerequisites section _(landed with the Astro 6 bump)_
- [x] Support-stance maintenance doc → `maintenance/support.md` _(landed with the Astro 6 bump)_
- [x] All tests and static checks pass _(284/284 as of the CSP work)_

**Version-support policy (DECIDED 2026-07-03, refined per Zack): align with [Astro's own stated support matrix](https://docs.astro.build/en/upgrade-astro/#nodejs-support-and-upgrade-policies), transitively.**

1. **Astro majors:** support the majors Astro itself maintains — the current major plus the previous (security-fixes-only) major. Today: 6 + 7.
2. **Node:** adopt Astro's Node policy as ours — "the latest _Maintenance_ LTS and the current _Active_ LTS" (their exact scope, including their rules for when floors move: Maintenance-LTS bumps in minors, major Node bumps in majors). Our `engines` mirrors the supported Astro majors' effective floor (today `>=22`), and integration code uses only Node/Astro features within that matrix.
3. **Statement to users:** "This integration supports the Astro versions Astro supports, on the Node versions Astro supports." One sentence, always true, self-updating in spirit — the README/maintenance doc lists the current concrete versions with a link to Astro's policy.
4. Older Astro majors (e.g. 5): out, because they fall outside Astro's own matrix — v5 is unmaintained upstream and floors on EOL Node (18/20). Re-evaluate at each Astro major; drops happen in a pagemeta major release, noted in the changelog.

**Exit criteria:** suite green on Astro 6 and 7 via the vendored harness; integration-kit gone; peer `^6.0.0 || ^7.0.0` (or exactly what passes) + engines `>=22`; stance written into MAINTENANCE docs + README prerequisites.

## M2 — Publish pipeline + CI foundation _(2–3 sessions; goal: a real package on npm)_

- [ ] GitHub Actions CI: lint, fmt, knip, typecheck, test
- [ ] **Astro × Node test matrix** (see [deps-security.md](./deps-security.md) §CI for the local-testing story):
    - Matrix legs: newest Astro major × newest Node LTS (the default), plus one leg per additional supported Astro major, plus supported-Node floor × newest Astro
    - Mechanism: small script that rewrites the `astro` catalog entry in `pnpm-workspace.yaml` + `pnpm install --no-frozen-lockfile`; same script works locally (`node scripts/use-astro.mjs 6 && pnpm test`, then `git restore pnpm-workspace.yaml pnpm-lock.yaml`)
    - Node versions: `actions/setup-node` matrix in CI; `mise`/`nvm` locally
- [ ] Supply-chain baseline in CI (decisions in [deps-security.md](./deps-security.md)): pin all GitHub Actions to commit SHAs; add audit step; Socket (or chosen alternative) on PRs
- [ ] Changesets: install, wire release workflow, write first changeset
- [ ] npm publish with provenance; keep publint + attw enforced in the build (attw: add explicit ignore/annotation for the `/Head` .astro export warning)
- [ ] Rewrite `packages/astro-fixture/README.md` for public repo consumption (currently references `planning/` docs and pre-publish context that won't survive the planning-folder deletion)
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
