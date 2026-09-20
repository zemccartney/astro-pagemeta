# Astro & Node Support Stance

**Policy: align with [Astro's own support matrix](https://docs.astro.build/en/upgrade-astro/#nodejs-support-and-upgrade-policies), transitively.** Aim to support the Astro versions Astro supports, on the Node versions Astro supports.

## The rules

1. **Astro majors:** support the majors Astro itself maintains — the current major plus the previous one (which receives security fixes only, per Astro's policy). Peer range = CI proves green.
2. **Node:** adopt Astro's Node policy as ours (latest _Maintenance_ LTS + current _Active_ LTS, with their rules for when floors move). Enforcement points, all mechanically checked by `pnpm --filter @grepco/ephemeris check:engines`:
    - `publishConfig.engines.node` must equal the installed Astro's `engines.node`
    - `src/tsconfig.json` `lib` must match the lowest supported Node major's ES year
    - `tsdown.config.ts` `target` must match the lowest supported Node major
3. **Older majors are dropped** when they leave Astro's window — in an ephemeris **major** release, noted in the changelog. Rationale example: Astro 5 was dropped because it's unmaintained upstream and floors on EOL Node 18/20; supporting it would endorse unpatched foundations.
4. **Re-evaluate at every Astro major and Node EOL date.** No standing promises beyond the current peer range.

## Current state (2026-07-12)

| Surface                | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| Astro peer range       | `^6.0.0 \|\| ^7.0.0` (suite verified green on 6.4.8 + 7.0.6) |
| Published Node engines | `>=22.12.0` (identical floor for astro@6 and astro@7)        |
| Dev toolchain Node     | 24 (`engines` in workspace package.json files)               |

The dev toolchain floor and the published floor are different claims. Several dev dependencies (eslint 10, tsdown) require Node above 22.12, so `engines` in the workspace manifests stays at 24 and `.npmrc` keeps `engine-strict`. `publishConfig.engines` carries the published floor precisely because the two differ. CI reflects this: every matrix leg installs on Node 24, and the floor leg switches Node only to run the suite (`.github/workflows/ci.yml`).

## Upgrade playbook (per Astro major)

1. Read the release announcement + upgrade guide
2. Bump the `astro` catalog entry; fix fallout with the full test suite as the guard (the static/SSR × dev/build matrix exists precisely for this).
3. Diff the two harness upstreams (`packages/astro-fixture/README.md` has commands): Astro's `test-utils.ts` between release tags tells you _what_ changed about driving Astro; inox-tools diffs show _how it looks in our file's shape_.
4. Run `check:engines`; align `publishConfig.engines` / `lib` / tsdown `target` to whatever it reports.
5. Decide the old major's fate per rule 3; set the peer range to what CI proves; changeset accordingly.
