Rough summary of how all the `tsconfig`s in the project work together. Not entirely sure I've stapled these together correctly.

- over-arching context: not using typescript for transpilation and building, only as a linter.

- root file: defines settings that all packages should follow
    - `lib: esnext` to support writing modern js by default in all files
    - set `module: nodenext` to default to node's module system; unfortunate, but necessary
      for our `eslint.config.ts` to typecheck
    - no target, as we're not using ts for transpilation / output

- playground: uses astro's typescript config, no relation to workspace root tsconfig

- astro-pagemeta
    - root:
        - tailored for node (config files, test writing)
        - uses node types to support node env; astro types to support astro work in fixtures
        - otherwise, same as root
    - src:
        - tailored for bundling, release to astro, hence `module: preserve` setting
        - lower `lib` setting (es2022) to align with the low end of astro's node support (in terms of syntax, not node APIs; the latter's a known limitation, see [below](#why-typescript-doesnt-flag-node-globals-in-files-without-node-types)); not sure I'm interpreting that support right i.e. if their supported node versions speaks to what deployment runtimes they work in (i guess it can't, given, say i'm not sure of cloudflare's ES support, how it aligns with node (API compatibility has been a point of emphasis for them, I know)). I feel like I'm not thinking about this clearly, likely overengineered around this constraint (see ts project references), but I guess unnecessarily sticking to a lower ES version is safer than adopting a later one ahead of astro

## known limitations

### no typechecking standalone astro files

- no typechecking on `.astro` files in non-Astro projects e.g. `Head.astro` and test fixtures in `astro-pagemeta`. Astro handles typechecking through its `check` library, which seems to run only within a project? unsure. but haven't gotten it to work with isolated astro files

### Why typescript doesn't flag node globals in files without node types

Neither root eslint.config.ts nor astro-pagemeta/src/ explicitly register node types — yet `process`, `Buffer`, etc. resolve without errors. This is NOT from pnpm hoisting.

The cause: `types`/`typeRoots` in tsconfig only control _automatic discovery_ of `@types/*` packages. They can't prevent types loaded via `/// <reference types="node" />` directives inside imported packages' `.d.ts` files. For example, `vite/dist/node/index.d.ts` contains `/// <reference types="node" />`, so any file that imports from `vite` (directly or transitively) gets all Node globals injected unconditionally.

For the root eslint.config.ts: the root tsconfig has no `types` field at all, so TypeScript auto-discovers every `@types/*` package it can find. Combined with transitive references from dependencies, node types are available.

Node globals are legitimate in library source since Astro runs on Node. The ideal would be restricting to Astro's lowest supported Node version's API surface, but there's no clean way: `@types/node@18` conflicts with dependencies that reference `@types/node` without version constraints, and ESLint's `globals.node` isn't versioned either. `lib: ["es2022"]` in src/tsconfig.json already covers the JS built-in side (matching Node 18's V8). For Node API surface, CI testing against Node 18 would be the reliable catch.
