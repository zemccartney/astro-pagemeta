# @grepco/astro-fixture

Private, vendored test harness for driving real Astro dev servers and builds in this workspace's tests. Not published.

## Why vendored

The upstream package (`@inox-tools/astro-tests`) gates its Astro support through a peer range (e.g. 1.0 supports only `astro ^6.0.8`), which put a third party on this workspace's Astro-upgrade critical path. Vendoring inverts that: we fix ~400 lines we can read, on our schedule. It also makes historically opaque test-infra behavior (undici agent config, server lifecycle — see `planning/artifacts/testing-isolation.md`) inspectable in-tree.

## Provenance

Vendored 2026-07-03 from **`@inox-tools/astro-tests@0.8.1`** (MIT, © Luiz Ferraz) — the exact version this workspace's suite was green on under Astro 5.

That package is itself a port of **Astro core's internal test harness** (`packages/astro/test/test-utils.ts` and `test-adapter.js` in [withastro/astro](https://github.com/withastro/astro)) from monorepo-internal `../dist/...` imports onto Astro's public programmatic API (`astro`, `astro/config`, `astro/app`). We vendored the port because the public API is the only stable contract available outside Astro's repo; Astro's own file cannot run against an installed `astro` package.

## Maintenance: the two-upstream diff

When upgrading Astro majors (or chasing harness bugs), consult both upstreams:

1. **Astro core (source of truth for driving Astro):** diff `packages/astro/test/test-utils.ts` between the old and new **release tags** (not `main` — `main` tracks unreleased Astro). This reveals how the Astro team adapted their own harness to their changes.
2. **inox-tools (packaging/harness fixes):** diff `packages/astro-tests/src/` between releases for fixes worth stealing (e.g. their 1.0 targets Astro 6).

## Deviations from upstream

- Trimmed to the surface this workspace uses: `config`, `startDevServer`, `build`, `resolveUrl`, `fetch`, `readFile`, `loadTestAdapterApp`. Dropped: `preview`, `sync`, `buildWithCli`, `clean`, `editFile`/`resetAllFiles`, `glob`, `readdir`, buffer/src readers, `loadNodeAdapterHandler`. Re-vendor from upstream if needed.
- `loadFixture` requires an absolute path or URL `root` (upstream resolved relative roots via caller stack inspection — removed; this workspace's `isolatedFixture()` always passes absolute temp-dir roots).
- Debug logging uses `node:util` `debuglog` instead of the `debug` package (one less dependency). Enable with `NODE_DEBUG="grepco:astro-fixture*"` (upstream used `DEBUG=inox-tools:astro-tests*`).
- `testAdapter`'s `env` option dropped (unused here); integration name is a literal.

## Usage

```ts
import { loadFixture } from "@grepco/astro-fixture/astroFixture";
import testAdapter from "@grepco/astro-fixture/testAdapter";

const fixture = await loadFixture({ root: "/abs/path/to/fixture" });
const devServer = await fixture.startDevServer({});
const res = await fixture.fetch("/");
await devServer.stop();

await fixture.build({ adapter: testAdapter() });
const app = await fixture.loadTestAdapterApp();
const response = await app.render(new Request("https://example.com/"));
```
