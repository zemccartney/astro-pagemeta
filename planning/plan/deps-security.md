# Dependency Management & Supply-Chain Security — Proposal

_Status: DRAFT for discussion. Decision points marked ⚖️ — settle these, then fold the outcomes into ROADMAP M2/M4 and delete or archive this file._

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

_(Corrected 2026-07-03: an earlier version claimed dropping `astro-integration-kit` cut the tree 314 → 27. Wrong — `pnpm ls` was counting **Astro itself**, resolved as aik's peer dependency, under aik. Consumers already have Astro; it's not surface we add.)_

Measured 2026-07-03, what `@grepco/astro-pagemeta` actually adds to a consumer's tree (excluding the `astro` peer):

- **~29 unique packages**: the unified/rehype ecosystem (27, via `rehype`, `rehype-meta`, `rehype-minify-whitespace`, `hast-util-select`) + `astro-integration-kit` + `pathe` + `schema-dts` (types-only, zero deps)
- The M1 aik migration (happening anyway for deprecation reasons) sheds only `astro-integration-kit` + `pathe`

The bigger real cut: `hast-util-select` is a direct dep used for exactly one call — `select("head", tree)`. A hand-rolled ~10-line tree walk drops it and the subtree only it needs (`css-selector-parser`, `nth-check` — of historical-CVE fame, `bcp-47-match`, `direction`, `hast-util-has-property`, …), landing the added surface around **~20 packages**, essentially all from one maintainer group (wooorm/unified collective — high-reputation, single trust domain). That's a defensible, explainable floor. Going lower means vendoring rehype-meta; not worth it (was tried once and abandoned — see git history).

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
6. Second reduction cut: hand-roll `select("head")` to drop `hast-util-select` (rec: yes, during M1 while tests are hot)?
