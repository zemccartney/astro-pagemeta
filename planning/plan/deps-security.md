# Dependency Management & Supply-Chain Security — Proposal

_Status: **DECIDED 2026-07-03** (Zack, via scratch/m1.md). Outcomes:_

1. _Published `dependencies`: **caret ranges** ✓_
2. _`minimumReleaseAge`: **7 days** ✓ (implemented: `pnpm-workspace.yaml` → 10080; `deps` script → `--cooldown 7d`. Note: ncu does not read pnpm's setting — verified, they're independent — and ncu's cooldown **silently skips any package whose latest release is under the window** (e.g. `@types/node` almost always), a documented registry limitation. pnpm's own gate still resolves those correctly at install.)_
3. _Cadence: **Renovate, after M2** ✓ (Zack hasn't used it — walk through setup together)_
4. _Scanners: **Socket only** + `pnpm audit` in CI ✓_
5. _npm auth: **trusted publishing / OIDC** ✓_
6. _hast-util-select cut: withdrawn (see Pillar 1)_

_Also decided: **drop Astro v5 support** — v5's published Node floor (18.20.8 / 20.3) includes EOL Node versions; see ROADMAP M1 for the full support stance. Remaining implementation lands in M2 (CI/Socket/OIDC) and M4 (Renovate). The pillars below stay as the rationale record._

**Goal (Zack's words):** upgrade dependencies with as few security worries as possible; reduce dependency count; have a foundational system — not ad-hoc vigilance — for a key maintenance routine.

## Where we already stand (better than you remember)

`pnpm-workspace.yaml` already ships real defenses most projects lack:

| Setting                                             | Effect                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minimumReleaseAge: 4320` (3 days)                  | Won't install packages younger than 3 days — the single best defense against the compromised-release worms (malicious versions are usually yanked within hours/days) |
| `onlyBuiltDependencies: [esbuild, lefthook, sharp]` | Install scripts blocked for everything else — kills the #1 execution vector                                                                                          |
| `trustPolicy: no-downgrade` + `blockExoticSubdeps`  | Blocks downgrade attacks and git/URL sub-dependencies                                                                                                                |
| `packageManager` + engines pinning                  | Reproducible toolchain                                                                                                                                               |

Note: `trustPolicyExclude: [vite@6.4.1, chokidar@4.0.3]` — revisit these exceptions after the M1/M2 upgrades; ideally the list goes to zero.

## Pillar 1 — Reduce the surface

_(Twice-corrected, final numbers 2026-07-03. First error: `pnpm ls` counted **Astro itself** — resolved as aik's peer — as aik's subtree ("293 packages from aik": wrong). Second error: a `pnpm ls --json` walk undercounted shared subtrees due to output dedupe ("27 packages": also wrong). The numbers below come from real scratch-dir `npm install`s of exactly the published prod deps, which is dedupe- and peer-proof.)_

**Measurement method** (rerun anytime):

```sh
mkdir /tmp/treecheck && cd /tmp/treecheck && npm init -y
# --legacy-peer-deps: don't auto-install the astro peer (consumers already have it)
npm install --ignore-scripts --legacy-peer-deps \
  astro-integration-kit@0.19.1 hast-util-select@6.0.4 rehype@13.0.2 \
  rehype-meta@4.0.1 rehype-minify-whitespace@6.0.2 schema-dts@1.1.5
npm ls --all --parseable | sort -u | grep -c node_modules
```

Results (2026-07-03):

- **Today: 64 packages** added to a consumer's tree (excluding the `astro` peer)
- **After the M1 aik migration: 62** (sheds `astro-integration-kit` + `pathe`)
- ~~Hand-rolling `select("head")` to drop `hast-util-select`~~ — **withdrawn: saves zero packages.** `rehype-meta` depends on `hast-util-select` itself, so the subtree (css-selector-parser, nth-check, …) ships regardless. Only worth doing as code simplification, never as a security measure.

So the honest posture: the floor is **~62 packages, essentially all from one maintainer group** (wooorm/unified collective — high-reputation, single trust domain, mostly zero-install-script micro-packages). Meaningful reduction below that requires replacing rehype-meta itself (vendoring was tried and abandoned — see git history; the Rust-replacement idea lives in BACKLOG). Accept 62 as the v1 number and spend security effort on the gates (Pillars 2–5), not the count.

Nuance worth knowing: on Astro ≤ 6, consumers already carry much of the unified/rehype ecosystem via Astro's own markdown pipeline, so our _marginal_ footprint there is smaller than 62. Astro 7's Sätteri removes unified from Astro's default path — going forward, this tree is genuinely ours.

Dev-dep tree stays big (eslint ecosystem etc.). Accept it: dev deps don't ship to consumers, and the install-script block + release-age gate cover the on-your-machine risk. Don't spend reduction effort there.

## Pillar 2 — Version policy in package files

⚖️ **Decision: exact pins vs. ranges in published `dependencies`?**
**Recommendation: keep caret ranges.** For a _library_, exact pins force duplicate copies into consumers' trees and make _their_ security patching worse (they can't dedupe past your pin). Your reproducibility is already guaranteed by the lockfile for dev/CI, and the release-age gate covers "new malicious version" risk at install time. Exact pinning is the right call for _applications_, not libraries. (If you want a middle ground: pin exact in `devDependencies` only — low value, but harmless.)

⚖️ **Decision: raise `minimumReleaseAge` 3 days → 7 days?**
**Recommendation: yes (10080).** You're a solo maintainer updating on a schedule, not chasing day-old releases; a week is when most compromises have been caught and yanked. Escape hatch exists per-install when you genuinely need a fresh release (`minimumReleaseAgeExclude`).

## Pillar 3 — Update cadence (the routine)

⚖️ **Decision: Renovate bot vs. manual scheduled runs?**

- **Option A — Renovate** (recommended once CI exists, i.e. after M2): grouped weekly PRs; auto-merge dev-dep patch/minor **only after CI green**; prod deps and all majors always manual; vulnerability alerts open PRs immediately regardless of schedule; also updates GitHub Actions (answers the old "how do I keep actions updated?" question). Config lives in-repo; it's the "system for peace of mind" you asked for.
- **Option B — manual cadence**: monthly calendar reminder → `pnpm deps` (ncu interactive, already has `--cooldown 3d`) + `pnpm audit`. Calmer, zero bot noise, but depends on your discipline — which is exactly what broke during the 3-month gap.

Either way, fix the root `deps` script to cover the whole workspace: needs `--workspaces` (and verify ncu handles pnpm `catalog:` entries; if not, catalog bumps stay manual — they're 4 lines).

_Update 2026-07-04 (found by Zack):_ ncu's **interactive mode with `--workspaces` prompts one package.json at a time** (root first), which reads as if it only covers root — likely sequential-by-design (Zack's read), not a bug, but easy to misread mid-flow. Non-interactive workspace reports work fine (verified: covers root, all packages, and the catalog). Scripts adjusted accordingly: `pnpm deps` = non-interactive workspace-wide report (cooldown-gated); `pnpm deps:all` = same without cooldown (full picture). For interactive ad-hoc tidying of one package, two equivalent options: `pnpm deps:pkg @grepco/astro-pagemeta` from root (ncu's `--workspace <name>` flag; also inspects the catalog), or `cd packages/astro-pagemeta && npx ncu -p pnpm -i --format group --cooldown 7d` (that package.json only).

Majors policy: never auto-taken. Astro majors get the ROADMAP §M1 case-by-case treatment; everything else gets a changelog read.

## Pillar 4 — Detection & audit tooling

⚖️ **Decision: which scanner(s)?** Recommendation, in order of value-per-noise:

1. **Socket** (GitHub app, free for OSS): behavioral analysis on PRs — flags new install scripts, network/fs/env access, obfuscation, maintainer changes. Catches what CVE databases can't (zero-day compromises). This was already on your RESUMING list; it's the right instinct.
2. **`pnpm audit`** in CI on a weekly cron + on lockfile-touching PRs: free CVE baseline.
3. Skip for now: Snyk/Trivy (overlap, heavier), OSV-scanner (redundant with the above at this scale), OpenSSF Scorecard (backlog; badge polish, not protection).

## Pillar 5 — Publish-side integrity (lands in M2)

- npm **trusted publishing (OIDC)** from GitHub Actions — no long-lived npm token to leak; provenance attestation comes with it (both were already on your list via "npm provenance")
- 2FA on the npm account; publish only via CI once the pipeline exists
- **Pin GitHub Actions to commit SHAs** (Renovate keeps them fresh)
- Keep publint + attw as release gates (already wired into tsdown)

## The routine, end state (write into the M4 runbook)

> Weekly-ish: merge/review Renovate PRs (dev-dep automerges usually already landed). Monthly: skim prod-dep PRs, read changelogs, merge. On security alert: Renovate/Socket flags it → CI green → merge → `changeset` → release. On Astro major: ROADMAP policy, dedicated session.

## ⚖️ Decision checklist (answer these, then implement)

1. Published `dependencies`: caret ranges (rec) or exact pins?
2. `minimumReleaseAge`: 7 days (rec) or keep 3?
3. Renovate (rec, post-M2) or manual monthly cadence?
4. Socket + pnpm audit (rec) — or audit-only to start?
5. npm trusted publishing via OIDC (rec) — any reason to prefer a granular token?
6. ~~Hand-roll `select("head")` to drop `hast-util-select`~~ — withdrawn 2026-07-03: rehype-meta pulls it in anyway, zero packages saved (see Pillar 1). No decision needed.
