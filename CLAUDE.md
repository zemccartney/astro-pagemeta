# Project Context for AI Agents

## What This Is

An Astro integration (`@grepco/astro-pagemeta`) that simplifies setting page metadata (title, description, OG tags). Users call `setPagemeta(Astro, {...})` in page frontmatter, and the integration automatically injects the corresponding meta tags into the rendered HTML via post-render middleware.

## Architecture

Four source files:

1. **`src/index.ts`** — Integration entry point. Creates a Vite plugin that generates the `virtual:pagemeta/config` module, registers middleware with `order: "post"`, and collects route patterns from `astro:routes:resolved`.
2. **`src/runtime.ts`** — Exports `setPagemeta()`, `resolvePagemeta()`, and `isPageRoute()`. Imported at runtime as `@grepco/astro-pagemeta/runtime` (via `package.json` exports mapping to this file directly — no stub). Uses a private `Symbol("pagemeta")` key for `Astro.locals` storage.
3. **`src/middleware.ts`** — Post-render middleware. Filters non-page routes via `isPageRoute()`, skips HTML fragments (no doctype), resolves metadata via `resolvePagemeta()`, and processes HTML with `rehype` + `rehype-meta`.
4. **`src/types.ts`** — TypeScript types for the three exported functions.

Type declarations for both the public module and the internal virtual module live in `src/virtual.d.ts`.

### Virtual Module System

The integration creates a custom Vite plugin (not `addVirtualImports`) that serves `virtual:pagemeta/config`. This module is generated at load time and contains:

- **`routePatterns`**: Array of `RegExp` objects derived from project page routes (collected in `astro:routes:resolved`)
- **`defaults`**: The user's defaults — either a serialized function (via `Function.toString()`), a JSON object, or `undefined`

Function serialization means **closures don't work** — any function default must be self-contained. Variables from outer scope produce `ReferenceError` at runtime. This is tested and documented as an intentional limitation.

### Data Flow

```
Page frontmatter: setPagemeta(Astro, { title: "My Page" })
    ↓
Stores in Astro.locals[Symbol("pagemeta")] — merges with prior calls
    ↓
Page renders HTML
    ↓
Middleware (post order) intercepts response:
  1. isPageRoute(pathname) → skip API routes, server islands, endpoints
  2. resolvePagemeta(context) → merge defaults + page metadata
  3. isHtmlDocument check → skip fragments (partials, server islands)
  4. rehype + rehype-meta → inject tags into <head>
    ↓
Modified HTML response returned
```

### Metadata Merge Hierarchy (highest priority wins)

```
setPagemeta() > integration defaults > template <meta> tags
```

User middleware can also call `setPagemeta()` before `next()` to set per-request defaults that pages can override. Passing `false` to `setPagemeta()` is a hard opt-out — skips all defaults and tag injection.

## Testing

Uses `@inox-tools/astro-tests` which wraps Astro's CLI APIs (`astro dev`, `astro build`). Tests run via vitest.

### Test Structure

```
tests/
├── basic/                     # Core setPagemeta functionality
│   ├── ssr.test.ts            # SSR dev + build
│   └── static.test.ts         # Static dev + build
├── integration-options/
│   ├── static-defaults/       # Object defaults
│   │   ├── ssr.test.ts
│   │   └── static.test.ts
│   └── function-defaults/     # Function defaults with APIContext access
│       ├── ssr.test.ts
│       ├── static.test.ts
│       ├── slug.ssr.astro     # Dynamic route pages injected at test time
│       └── slug.static.astro
├── error-handling/
│   └── defaults-function.test.ts  # Edge cases: invalid returns, closures, throws
├── route-filtering/
│   └── ssr.test.ts            # Server islands, API routes, partials, rewrites
├── middleware-ordering/
│   └── ssr.test.ts            # User middleware → integration middleware interaction
├── fixtures/                  # Shared Astro project fixtures
│   ├── basic/
│   ├── defaults/
│   ├── error-handling/
│   ├── middleware-defaults/
│   └── route-filtering/
└── utils/
    ├── html-parse.ts          # extractMeta(), isFragment(), extractServerIslandUrl()
    ├── isolated-fixture.ts    # Temp dir fixture isolation
    └── error-capture/         # Test integration for capturing middleware errors
```

### Critical Testing Rules

**Integration config goes in test files, not fixture configs.** `@inox-tools/aik-mod` has a global module registry that throws "Module already defined" if a module ID is registered twice. Fixture `astro.config.ts` files must NOT include the pagemeta integration — it's passed only via inline config to `startDevServer()` / `build()`.

**One build config per test file.** Build calls can't re-register the module. Dev server calls silently overwrite, so multiple configs per file work for dev tests only (with sequential execution and proper server cleanup).

### Fixture Isolation: `isolatedFixture()`

All tests use `isolatedFixture(name, inlineConfig?)` which:
1. Copies fixture to a temp dir in `.test-tmp/` (filters out `.astro`, `dist`, `node_modules`)
2. Returns `{ fixture, cleanup(), inject(dest, source) }`
3. `inject()` adds files dynamically (used for SSR vs static dynamic route pages)

Temp dirs live inside the project tree so Vite can resolve `node_modules`.

### Test Patterns

Each test file covers both dev server and build in separate `describe` blocks:

```typescript
const { cleanup, fixture } = await isolatedFixture("basic", {
    adapter: testAdapter(),   // SSR tests only
    output: "server"          // SSR tests only
});

const config = { integrations: [pagemeta()] };
afterAll(() => cleanup());

describe("SSR / dev server", () => {
    let devServer: ...;
    beforeAll(async () => { devServer = await fixture.startDevServer(config); });
    afterAll(async () => { await devServer.stop(); });

    test("...", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();
        expect(extractMeta(html)).toEqual([...]);
    });
});

describe("SSR / build", () => {
    let app: TestApp;
    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("...", async () => {
        const response = await app.render(new Request("https://example.com/"));
        // ...
    });
});
```

### Test Utilities

- **`extractMeta(html)`** — Parses HTML, walks `<head>`, returns `{ tag, properties }[]`. rehype-parse uses camelCase (`charSet` not `charset`).
- **`isFragment(html)`** — Returns true if HTML lacks a doctype node.
- **`extractServerIslandUrl(html)`** — Finds server island preload `<link>` href.
- **`createErrorCapture()`** — Returns an integration + `lastError()` accessor. Uses `globalThis` with a random key to capture errors across the middleware boundary. Call `dispose()` in `afterEach`.

## Key Files

- `src/index.ts` — Integration entry, Vite plugin, route collection
- `src/runtime.ts` — `setPagemeta()`, `resolvePagemeta()`, `isPageRoute()`
- `src/middleware.ts` — Post-render middleware using `defineMiddleware` from `astro/middleware`
- `src/types.ts` — Public type exports (`SetPagemeta`, `ResolvePagemeta`, `IsPageRoute`)
- `src/virtual.d.ts` — Module declarations for `@grepco/astro-pagemeta/runtime` and `virtual:pagemeta/config`
- `MAINTENANCE.md` — Detailed test organization guide, known quirks, and architecture decisions

## Commands

- `pnpm test` — Run vitest (only `tests/**/*.test.ts`)
- `pnpm lint` — ESLint (uses `--flag unstable_native_nodejs_ts_config`)
- `pnpm fmt` — Prettier (check mode); `pnpm fmt:fix` to write
- `pnpm typecheck` — `tsc --noEmit`

## Important Patterns

1. **Runtime import path**: `@grepco/astro-pagemeta/runtime` — maps directly to `src/runtime.ts` via package.json exports
2. **Middleware typing**: Use `defineMiddleware` from `astro/middleware` (not `astro:middleware` — that's for user-land code)
3. **Symbol-based locals**: `Symbol("pagemeta")` is defined in `runtime.ts`, never exported, shared between `setPagemeta` and `resolvePagemeta`
4. **HTML document detection**: Middleware checks `/^<!doctype\s/i` to distinguish full documents from fragments (server islands, partials)
5. **Route filtering**: Only project page routes get processed. API routes, endpoints, server islands, and config redirects are skipped via `isPageRoute()` which matches against patterns from `astro:routes:resolved`.

## Known Limitations

- **Function defaults can't close over variables** — serialized via `Function.toString()` into a virtual module, so outer scope isn't available
- **`@inox-tools/aik-mod` global registry** — module IDs can only be registered once per build; see MAINTENANCE.md for testing implications

## TODOs

- LD-JSON support
- Image service integration
- JSDoc comments
- Publishing pipeline (build tooling, changesets, CI)

## Dependencies

- **Runtime**: `rehype`, `rehype-meta` (HTML processing), `astro-integration-kit` (integration helpers)
- **Peer**: `astro` 5.x.x
- **Dev/Test**: `@inox-tools/astro-tests`, `@astrojs/node` (SSR adapter), `vitest`, `rehype-parse` + `unified` (test HTML parsing)

## Architecture Diagrams

- [Integration Runtime Architecture](docs/integration-runtime-architecture.mermaid) — build-time setup through request-time meta tag injection
- [Codebase File Architecture](docs/codebase-file-architecture.mermaid) — how all source, test, fixture, and config files relate
