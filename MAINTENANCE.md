# Test Maintenance Guide

## Principles (TLDR)

- one fixture per dev / build combination, to avoid file system collision across different rendering modes
- **build tests**: one configuration case per file (strict requirement)
- **dev tests**: multiple configurations allowed per file, but tests must run sequentially and stop servers properly
- for all configuration cases tested, verify behavior across ssr and static rendering

## Test File Organization

Tests are organized by **feature category**, then split by **output mode** (static/SSR), with separate fixtures per output mode:

```
tests/
├── basic/
│   ├── static/
│   │   ├── fixture/
│   │   │   └── src/pages/...
│   │   ├── build.test.ts
│   │   └── dev.test.ts
│   └── ssr/
│       ├── fixture/
│       │   ├── astro.config.ts  ← output: "server"
│       │   └── src/pages/...
│       ├── build.test.ts
│       └── dev.test.ts
└── integration-options/
    ├── static-defaults/
    │   ├── static/
    │   │   ├── fixture/...
    │   │   ├── build.test.ts
    │   │   └── dev.test.ts
    │   └── ssr/
    │       ├── fixture/...
    │       ├── build.test.ts
    │       └── dev.test.ts
    └── function-defaults/
        ├── static/...
        └── ssr/...
```

## Why Separate Fixtures Per Output Mode?

### Guaranteed Isolation

Each output mode (static vs SSR) gets its own fixture directory. This ensures:

- No shared `dist/` folder between test modes
- No possibility of build artifacts from one mode affecting another
- No need to understand Astro internals about output directory handling

### What Goes Where

**In the fixture's `astro.config.ts`:**

- `output: "server"` for SSR fixtures (intrinsic to the output mode)
- Static fixtures typically have no config file (uses defaults)

**In the test file's `loadFixture()` call:**

- `adapter: testAdapter()` for SSR tests (test infrastructure, not fixture config)
- `root: "./fixture"` pointing to the local fixture

**In the test file's inline config (passed to `build()`/`startDevServer()`):**

- `integrations: [pagemeta(...)]` - always passed here, never in fixture config
- `site` and other per-test configuration

## Why Integration Config Lives in Test Files

### The Problem: Module Double-Registration

`@inox-tools/aik-mod` maintains a **global module registry**. When a module ID is registered twice, it throws "Module already defined".

This happens when:

1. A fixture's `astro.config.ts` includes the pagemeta integration
2. The test file then calls `build()` or `startDevServer()` with the same integration
3. Both calls trigger `astro:config:setup`, registering the module twice

### The Solution

**Fixture configs must NOT include the pagemeta integration.** The integration is passed only via the inline config:

```typescript
// Fixture astro.config.ts - output mode only, NO integrations
import { defineConfig } from "astro/config";
export default defineConfig({
    output: "server" // For SSR fixtures
});

// Test file
const fixture = await loadFixture({
    adapter: testAdapter(),
    root: "./fixture"
});

const config = {
    integrations: [pagemeta()], // Integration ONLY here
    site: "https://example.com"
} satisfies AstroInlineConfig;

await fixture.build(config);
```

## SSR vs Static Fixture Differences

### SSR Fixtures

- Have `astro.config.ts` with `output: "server"`
- Dynamic routes (`[slug].astro`) do NOT need `getStaticPaths`
- Tests use `testAdapter()` and render via `app.render(new Request(...))`

### Static Fixtures

- Typically have no `astro.config.ts` (default static output)
- Dynamic routes MUST have `getStaticPaths` to generate pages
- Build tests read files via `fixture.readFile("/path/index.html")`

## Test Case Alignment

For consistency, related test suites should cover the same scenarios. For example, both `static-defaults` and `function-defaults` test:

1. Defaults applied to page without `setPagemeta()`
2. Page-level metadata overrides defaults
3. `metadata: false` skips all defaults

This makes it easy to verify both features work the same way.

## Running Tests

```bash
# Run all tests
pnpm test

# Run sequentially (more reliable for dev server tests)
pnpm test -- --no-file-parallelism

# Run specific test file
pnpm test tests/basic/static/dev.test.ts
```

## Build Tests vs Dev Tests: Configuration Rules

### The Underlying Issue

`@inox-tools/inline-mod` maintains a global module registry. When a module ID is registered twice:

- **Build mode**: Throws "Module already defined" error
- **Dev mode**: Silently overwrites the registry entry

See `.plan/BUG_REPORT_INLINE_MOD.md` for full details.

### Build Tests: One Configuration Per File (Strict)

Build tests (`fixture.build()`) **must** have only one integration configuration per file. The second `build()` call will throw.

```typescript
// ❌ WRONG - second build throws "Module already defined"
await fixture.build({ integrations: [pagemeta({ defaults: { title: "A" } })] });
await fixture.build({ integrations: [pagemeta({ defaults: { title: "B" } })] });
```

This is why we have separate files like `static/build.test.ts` and `ssr/build.test.ts`.

### Dev Tests: Multiple Configurations Allowed (With Caveats)

Dev tests (`fixture.startDevServer()`) can test multiple configurations in one file because the registry silently overwrites. However, this only works if:

1. **Tests run sequentially** (vitest default within a file)
2. **Each test stops its server before the next starts**

```typescript
// ✅ OK - sequential with proper cleanup
test("config A", async () => {
    const dev = await fixture.startDevServer({
        integrations: [pagemeta(configA)]
    });
    try {
        // assertions
    } finally {
        await dev.stop(); // Must complete before next test
    }
});

test("config B", async () => {
    const dev = await fixture.startDevServer({
        integrations: [pagemeta(configB)]
    });
    // ...
});
```

**Warning**: If two servers run concurrently, the second overwrites the first's module. Server A would then return Server B's content. This is a footgun - test behavior depends on execution order, not server identity.

### When to Use Each Pattern

| Scenario                            | Pattern                                       |
| ----------------------------------- | --------------------------------------------- |
| Testing output modes (static/SSR)   | Separate files per mode                       |
| Testing integration options         | Separate files per option set                 |
| Testing error handling / edge cases | Single dev-test file with multiple configs    |
| Verifying build behavior            | Must use build tests (dev won't catch issues) |

## Virtual Module / Runtime Stub Sync

The runtime module has three layers that must stay in sync when adding or removing exports:

1. **`src/index.ts`** — `constExports` in `defineModule()` defines what the virtual module contains
2. **`runtime-stub.js`** — re-exports each name from the virtual module; this is what `@grepco/astro-pagemeta/runtime` resolves to via `package.json#exports`
3. **`src/virtual.d.ts`** — type declarations for the public module specifier

If an export is added to `constExports` but not to `runtime-stub.js`, it will be `undefined` at runtime. The stub can't use `export *` because it bridges a dynamic `import()` of the virtual module — each export must be forwarded by name.

## Known Quirks

### Trailing Slashes in Static Builds

Static builds with `build.format: "directory"` normalize URLs with trailing slashes. If your function defaults use `ctx.url.pathname`:

- Dev server: `/test-page`
- Static build: `/test-page/`

The `function-defaults` static build test uses explicit `build.format: "directory"` to make this behavior predictable.

### Dev Server Race Conditions

Running many dev server tests in parallel can cause socket errors (`ECONNREFUSED`, `other side closed`). Use `--no-file-parallelism` if you see flaky failures.
